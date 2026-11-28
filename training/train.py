"""
Train the learned evaluator (lib/game/ai-net.ts) on self-play positions from scripts/ai-selfplay.ts.

  training/.venv/Scripts/python training/train.py --data training/data/gen1 [--data more/] --out public/ai/evaluator.bin

The network: sparse features (on/off) summed through an embedding bag plus dense features
through a linear layer, ReLU, a second layer, ReLU, one logit for "this seat wins". Positions are
split into training and validation by game, so it is never scored on games it learned from.

Writes the weights in the format ai-net.ts reads, and <out>.cases.json: a few validation
positions with the logit PyTorch gives them, which lib/game/ai-net.test.ts checks the TypeScript
forward pass against.
"""
import argparse
import glob
import json
import os
import re
import struct
import time

import numpy as np
import torch
from torch import nn


KINDS = ["civil", "political", "military", "popularity", "ideological", "cultural", "diplomatic"]


def victory_kinds(records_path, games):
    """Each position's game's victory kind (an index into KINDS, -1 if the records aren't there)."""
    kinds = np.full(len(games), -1, dtype=np.int64)
    if not records_path or not os.path.exists(records_path):
        return kinds
    of_game = {}
    pattern = re.compile(r'"game":(\d+).*?"kind":"(\w+)"')
    with open(records_path, encoding="utf8") as f:
        for line in f:
            m = pattern.search(line[:2000])
            if m and m.group(2) in KINDS:
                of_game[int(m.group(1))] = KINDS.index(m.group(2))
    for g in np.unique(games):
        if int(g) in of_game:
            kinds[games == g] = of_game[int(g)]
    return kinds


def shards(dirs):
    """Every shard in the given directories (its summary and file stem), checking they share one layout."""
    found, meta = [], None
    for directory in dirs:
        for summary_path in sorted(glob.glob(os.path.join(directory, "*.json"))):
            summary = json.load(open(summary_path))
            if meta is None:
                meta = {k: summary[k] for k in ("featureVersion", "sparseCount", "denseCount")}
                meta["expansionGames"] = 0
            elif any(meta[k] != summary[k] for k in ("featureVersion", "sparseCount", "denseCount")):
                raise SystemExit(f"{summary_path}: another feature layout than {meta}")
            meta["expansionGames"] += summary.get("expansionGames", 0)
            found.append((summary, summary_path[: -len(".json")]))
    if not found:
        raise SystemExit("No shards found")
    return meta, found


def load(dirs, kinds=False, keep=1.0, bootstrap=None, lam=0.7, seed=1):
    """
    All shards in the given directories, as one padded dataset: (meta, idx, dense, target, result,
    game, expansion[, kind]). `result` is each position's seat's result; `target` is what it
    learns: the result, or with a `bootstrap` evaluator its TD(lambda) target (computed on whole
    games, before any position is left out). `keep` < 1 keeps that share of the positions (at
    random): positions of one game are much alike, so more games with fewer positions each teach
    more in the same memory. Arrays are filled shard by shard, never held twice.
    """
    meta, found = shards(dirs)
    # First pass: sizes and which positions to keep.
    width, masks = 0, []
    for number, (_, base) in enumerate(found):
        counts = np.diff(np.fromfile(base + ".off", dtype=np.uint32).astype(np.int64))
        width = max(width, int(counts.max()) if len(counts) else 0)
        if keep < 1:
            masks.append(np.random.default_rng(seed * 1_000_003 + number).random(len(counts)) < keep)
        else:
            masks.append(np.ones(len(counts), dtype=bool))
    total = int(sum(int(m.sum()) for m in masks))
    pad = meta["sparseCount"]
    idx = np.full((total, width), pad, dtype=np.int16 if pad < 32767 else np.int32)
    dense = np.empty((total, meta["denseCount"]), dtype=np.float16)
    target = np.empty(total, dtype=np.float32)
    result = np.empty(total, dtype=np.float32)
    game = np.empty(total, dtype=np.int64)
    expansion = np.empty(total, dtype=bool)
    kind = np.empty(total, dtype=np.int64) if kinds else None
    model = read_weights(bootstrap, meta) if bootstrap else None
    gap = right = 0.0
    at = 0
    for number, ((summary, base), mask) in enumerate(zip(found, masks)):
        off = np.fromfile(base + ".off", dtype=np.uint32).astype(np.int64)
        counts = np.diff(off)
        games = np.fromfile(base + ".game", dtype=np.uint32).astype(np.int64)
        flat = np.fromfile(base + ".idx", dtype=np.uint16)
        padded = np.full((len(counts), width), pad, dtype=idx.dtype)
        padded[np.arange(width)[None, :] < counts[:, None]] = flat.astype(idx.dtype)
        # Half precision in memory (features are small numbers); batches go back to float32.
        part_dense = np.fromfile(base + ".dense", dtype=np.float32).reshape(-1, meta["denseCount"]).astype(np.float16)
        y = np.fromfile(base + ".y", dtype=np.uint8).astype(np.float32)
        t = y
        if model is not None:
            t, chance = td_targets(model, padded, part_dense, y, games, lam)
            gap += float(np.abs(t - y).sum())
            right += float(((chance > 0.5) == (y > 0.5)).sum())
        n = int(mask.sum())
        idx[at : at + n] = padded[mask]
        dense[at : at + n] = part_dense[mask]
        target[at : at + n] = t[mask]
        result[at : at + n] = y[mask]
        game[at : at + n] = games[mask] + number * 10_000_000
        # Shards come from one setting each; mostly-expansion shards count as expansion.
        expansion[at : at + n] = summary.get("expansionGames", 0) * 2 > summary["games"]
        if kind is not None:
            kind[at : at + n] = victory_kinds(summary.get("records"), games)[mask]
        at += n
        del padded, part_dense, flat
    if model is not None:
        positions = sum(len(m) for m in masks)
        print(f"TD({lam}) targets from {bootstrap}: mean |target - result| {gap / positions:.3f}; its accuracy on results {right / positions:.3f}")
    data = (meta, idx, dense, target, result, game, expansion)
    return data + (kind,) if kinds else data


class Evaluator(nn.Module):
    def __init__(self, sparse, dense, h1, h2, dropout=0.0, aux=0):
        super().__init__()
        self.drop = nn.Dropout(dropout)
        self.sparse = nn.EmbeddingBag(sparse + 1, h1, mode="sum", padding_idx=sparse)
        self.dense = nn.Linear(dense, h1)
        self.second = nn.Linear(h1, h2)
        self.out = nn.Linear(h2, 1)
        # Training only (not exported): how the game ends, `aux` ways (who wins, and by what).
        self.aux = nn.Linear(h2, aux) if aux else None
        nn.init.normal_(self.sparse.weight, std=0.02)
        with torch.no_grad():
            self.sparse.weight[sparse].zero_()

    def hidden(self, idx, dense):
        x = self.drop(torch.relu(self.sparse(idx) + self.dense(dense)))
        return torch.relu(self.second(x))

    def forward(self, idx, dense):
        return self.out(self.hidden(idx, dense)).squeeze(-1)


def read_weights(path, meta):
    """A model from a weights file written by export()."""
    data = open(path, "rb").read()
    if data[:4] != b"PAXN":
        raise SystemExit(f"{path}: not an evaluator file")
    (length,) = struct.unpack("<I", data[4:8])
    header = json.loads(data[8 : 8 + length])
    if header["featureVersion"] != meta["featureVersion"]:
        raise SystemExit(f"{path}: trained on {header['featureVersion']}, the data is {meta['featureVersion']}")
    h1, h2 = header["hidden"]
    floats = np.frombuffer(data[8 + length :], dtype="<f4")
    model = Evaluator(header["sparse"], header["dense"], h1, h2)
    at = 0

    def take(count, shape):
        nonlocal at
        part = torch.from_numpy(floats[at : at + count].copy()).reshape(shape)
        at += count
        return part

    with torch.no_grad():
        model.sparse.weight[: header["sparse"]] = take(header["sparse"] * h1, (header["sparse"], h1))
        model.dense.weight.copy_(take(header["dense"] * h1, (header["dense"], h1)).T)
        model.dense.bias.copy_(take(h1, (h1,)))
        model.second.weight.copy_(take(h1 * h2, (h1, h2)).T)
        model.second.bias.copy_(take(h2, (h2,)))
        model.out.weight.copy_(take(h2, (1, h2)))
        model.out.bias.copy_(take(1, (1,)))
    model.eval()
    return model


def td_targets(model, idx, dense, y, game, lam):
    """
    TD(lambda) targets: each position's target mixes the previous evaluator's win chance for the
    seat's next recorded position with that position's own target, back from the final result.
    Positions are stored game by game in move order, both seats per move (seat 0, then seat 1).
    """
    with torch.no_grad():
        chance = np.concatenate(
            [
                torch.sigmoid(model(torch.from_numpy(idx[s : s + 8192].astype(np.int64)), torch.from_numpy(dense[s : s + 8192].astype(np.float32)))).numpy()
                for s in range(0, len(y), 8192)
            ]
        )
    target = y.astype(np.float32)
    starts = np.flatnonzero(np.r_[True, game[1:] != game[:-1]])
    ends = np.r_[starts[1:], len(y)]
    for start, end in zip(starts, ends):
        for seat in (0, 1):
            rows = np.arange(start + seat, end, 2)
            later = y[rows[-1]] if len(rows) else 0.0
            for row in rows[::-1]:
                # The last position looks at the result; earlier ones at the next position's view.
                target[row] = later
                later = lam * later + (1 - lam) * chance[row]
    return target, chance


def export(model, meta, h1, h2, path, notes):
    # It knows Legacy & Diplomacy only if it learned from such games.
    header = {"featureVersion": meta["featureVersion"], "sparse": meta["sparseCount"], "dense": meta["denseCount"], "hidden": [h1, h2], "expansion": meta.get("expansionGames", 0) > 0, "trained": notes}
    text = json.dumps(header).encode()
    text += b" " * (-len(text) % 4)
    with torch.no_grad():
        arrays = [
            model.sparse.weight[: meta["sparseCount"]],  # [sparse, h1]
            model.dense.weight.T,  # [dense, h1]
            model.dense.bias,  # [h1]
            model.second.weight.T,  # [h1, h2]
            model.second.bias,  # [h2]
            model.out.weight[0],  # [h2]
            model.out.bias,  # [1]
        ]
        floats = np.concatenate([a.detach().cpu().numpy().astype("<f4").ravel() for a in arrays])
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"PAXN" + struct.pack("<I", len(text)) + text + floats.tobytes())
    return len(floats)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", action="append", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--hidden", type=int, nargs=2, default=[128, 32])
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch", type=int, default=2048)
    parser.add_argument("--lr", type=float, default=2e-3)
    parser.add_argument("--val", type=float, default=0.05, help="share of games held out")
    parser.add_argument("--dropout", type=float, default=0.2)
    parser.add_argument("--wd", type=float, default=1e-2, help="weight decay")
    parser.add_argument("--bootstrap", help="a previous evaluator: train on TD(lambda) targets from its view instead of results alone")
    parser.add_argument("--lam", type=float, default=0.7, help="TD(lambda): how much the result reaches back (1 = results alone)")
    parser.add_argument("--expansion-weight", type=int, default=1, help="show Legacy & Diplomacy positions this many times per epoch (they are the minority); 0 leaves them out")
    parser.add_argument("--aux-weight", type=float, default=0.0, help="also learn how each game ends (who wins, and by which victory), from results, with this weight: shapes the hidden layers; not exported")
    parser.add_argument("--keep", type=float, default=1.0, help="keep this share of each shard's positions (at random), to fit more games in memory")
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()
    torch.manual_seed(args.seed)
    torch.set_num_threads(max(1, os.cpu_count() // 2))

    loaded = load(args.data, kinds=args.aux_weight > 0, keep=args.keep, bootstrap=args.bootstrap, lam=args.lam, seed=args.seed)
    # `y` is what it learns (TD targets with --bootstrap); held-out positions are always scored
    # against `result`, what happened.
    meta, idx, dense, y, result, game, expansion = loaded[:7]
    # The auxiliary head's classes: the seat wins by KINDS[k] (k), or loses to it (len(KINDS) + k).
    aux_class = np.where(loaded[7] < 0, -1, loaded[7] + np.where(result > 0.5, 0, len(KINDS))) if args.aux_weight > 0 else None
    if aux_class is not None:
        print(f"how games end, known for {(aux_class >= 0).mean():.3f} of positions (weight {args.aux_weight})")
    held = (game * 2654435761 % 1000) < args.val * 1000
    train, val = np.where(~held)[0], np.where(held)[0]
    print(f"{len(y)} positions ({len(train)} train, {len(val)} validation) from {len(np.unique(game))} games; {meta}")
    # Each epoch: every training position once, expansion ones `--expansion-weight` times
    # (0: a base-game evaluator, which leaves them out and is judged on base games alone).
    if args.expansion_weight == 0:
        train, val = train[~expansion[train]], val[~expansion[val]]
        meta["expansionGames"] = 0
    epoch_ids = np.concatenate([train] + [train[expansion[train]]] * max(0, args.expansion_weight - 1))
    val_expansion = val[expansion[val]]
    h1, h2 = args.hidden
    model = Evaluator(meta["sparseCount"], meta["denseCount"], h1, h2, args.dropout, aux=2 * len(KINDS) if aux_class is not None else 0)
    aux_loss = nn.CrossEntropyLoss(ignore_index=-1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
    schedule = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs * (len(epoch_ids) // args.batch + 1))
    loss_fn = nn.BCEWithLogitsLoss()

    def batch(ids):
        return torch.from_numpy(idx[ids].astype(np.int64)), torch.from_numpy(dense[ids].astype(np.float32)), torch.from_numpy(y[ids])

    def evaluate(ids):
        model.eval()
        total, right, brier = 0.0, 0, 0.0
        with torch.no_grad():
            for start in range(0, len(ids), 8192):
                part = ids[start : start + 8192]
                i, d, _ = batch(part)
                t = torch.from_numpy(result[part])
                logits = model(i, d)
                total += loss_fn(logits, t).item() * len(t)
                p = torch.sigmoid(logits)
                right += ((p > 0.5).float() == t).sum().item()
                brier += ((p - t) ** 2).sum().item()
        model.train()
        return total / len(ids), right / len(ids), brier / len(ids)

    rng = np.random.default_rng(args.seed)
    history = []
    # Keep the epoch that does best on held-out games (later ones may only memorize).
    best = (float("inf"), None, None)
    for epoch in range(args.epochs):
        started = time.time()
        order = rng.permutation(epoch_ids)
        running = running_aux = 0.0
        for start in range(0, len(order), args.batch):
            ids = order[start : start + args.batch]
            i, d, t = batch(ids)
            if model.aux is not None:
                h = model.hidden(i, d)
                loss = loss_fn(model.out(h).squeeze(-1), t)
                extra = aux_loss(model.aux(h), torch.from_numpy(aux_class[ids]))
                running_aux += extra.item() * len(t)
                loss_all = loss + args.aux_weight * extra
            else:
                loss = loss_all = loss_fn(model(i, d), t)
            optimizer.zero_grad()
            loss_all.backward()
            optimizer.step()
            schedule.step()
            running += loss.item() * len(t)
        val_loss, val_acc, val_brier = evaluate(val)
        if val_loss < best[0]:
            best = (val_loss, epoch + 1, {k: v.detach().clone() for k, v in model.state_dict().items()})
        entry = {"epoch": epoch + 1, "train": running / len(order), "val": val_loss, "accuracy": val_acc, "brier": val_brier}
        line = f"epoch {epoch + 1}: train {running / len(order):.4f}  val {val_loss:.4f}  accuracy {val_acc:.3f}  brier {val_brier:.4f}"
        if model.aux is not None:
            line += f"  how games end {running_aux / len(order):.4f}"
        if len(val_expansion):
            # (Only when there are expansion games: the header is JSON, which has no NaN.)
            entry["valExpansion"], entry["accuracyExpansion"], _ = evaluate(val_expansion)
            line += f"  expansion val {entry['valExpansion']:.4f} accuracy {entry['accuracyExpansion']:.3f}"
        history.append(entry)
        print(f"{line}  ({time.time() - started:.0f}s)")

    model.load_state_dict(best[2])
    print(f"keeping epoch {best[1]} (validation loss {best[0]:.4f})")
    notes = {"data": args.data, "positions": int(len(y)), "games": int(len(np.unique(game))), "epochs": args.epochs, "expansionWeight": args.expansion_weight, "kept": history[best[1] - 1], "date": time.strftime("%Y-%m-%d")}
    if args.bootstrap:
        notes.update(bootstrap=os.path.basename(args.bootstrap), lam=args.lam)
    if args.aux_weight:
        notes["auxWeight"] = args.aux_weight
    if args.keep < 1:
        notes["keep"] = args.keep
    count = export(model, meta, h1, h2, args.out, notes)
    # Parity cases for the TypeScript forward pass.
    model.eval()
    cases = []
    with torch.no_grad():
        for k in val[:: max(1, len(val) // 12)][:12]:
            i, d, _ = batch(np.array([k]))
            sparse = [int(v) for v in idx[k] if v != meta["sparseCount"]]
            cases.append({"sparse": sparse, "dense": [float(v) for v in dense[k]], "logit": float(model(i, d)[0])})
    json.dump({"featureVersion": meta["featureVersion"], "cases": cases}, open(args.out + ".cases.json", "w"))
    print(f"wrote {args.out} ({count} weights, {os.path.getsize(args.out) // 1024} KB) and {len(cases)} parity cases")


if __name__ == "__main__":
    main()
