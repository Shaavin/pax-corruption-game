"""
Carry an evaluator over to a feature layout that only appends dense features: the new features
get zero weights, so it judges every position exactly as before. Then it can bootstrap TD
targets (train.py --bootstrap) on data encoded with the new layout, instead of starting again
from results.

    training/.venv/Scripts/python training/widen.py <old.bin> <new.bin> --version pax-features-N --dense COUNT

COUNT is the new layout's dense feature count (`denseCount` in an encoded summary .json). Only
for appended dense features: a layout that changes or reorders anything else needs training from
results again.

To ship a widened evaluator, add `--cases <encoded dir>` (data in the new layout): it also writes
`<new.bin>.cases.json`, positions with the logit PyTorch gives them, for lib/game/ai-net.test.ts.
"""

import argparse
import json
import struct

import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("old")
    parser.add_argument("new")
    parser.add_argument("--version", required=True, help="the new FEATURE_VERSION")
    parser.add_argument("--dense", type=int, required=True, help="the new dense feature count")
    parser.add_argument("--cases", help="an encoded data directory in the new layout: write parity cases from it")
    args = parser.parse_args()

    data = open(args.old, "rb").read()
    if data[:4] != b"PAXN":
        raise SystemExit(f"{args.old}: not an evaluator file")
    (length,) = struct.unpack("<I", data[4:8])
    header = json.loads(data[8 : 8 + length])
    if args.dense < header["dense"]:
        raise SystemExit(f"{args.old} already reads {header['dense']} dense features")
    floats = np.frombuffer(data[8 + length :], dtype="<f4")
    h1 = header["hidden"][0]
    # Weights are stored sparse [sparse, h1], then dense [dense, h1]: new rows go after the dense ones.
    cut = (header["sparse"] + header["dense"]) * h1
    floats = np.concatenate([floats[:cut], np.zeros((args.dense - header["dense"]) * h1, dtype="<f4"), floats[cut:]])
    header.update(featureVersion=args.version, dense=args.dense)
    header["trained"] = {**header.get("trained", {}), "widenedFrom": args.old.replace("\\", "/").split("/")[-1]}
    text = json.dumps(header).encode()
    text += b" " * (-len(text) % 4)
    open(args.new, "wb").write(b"PAXN" + struct.pack("<I", len(text)) + text + floats.astype("<f4").tobytes())
    print(f"{args.new}: {args.version}, {header['dense']} dense features")
    if args.cases:
        write_cases(args.new, args.cases)


def write_cases(path, directory):
    """Parity cases for the TypeScript forward pass, as train.py writes them."""
    import os
    import sys

    import torch

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from train import load, read_weights

    meta, idx, dense, _, _, _ = load([directory])
    model = read_weights(path, meta)
    cases = []
    with torch.no_grad():
        for k in range(0, len(dense), max(1, len(dense) // 12))[:12]:
            logit = model(torch.from_numpy(idx[k : k + 1].astype(np.int64)), torch.from_numpy(dense[k : k + 1].astype(np.float32)))[0]
            sparse = [int(v) for v in idx[k] if v != meta["sparseCount"]]
            cases.append({"sparse": sparse, "dense": [float(v) for v in dense[k]], "logit": float(logit)})
    json.dump({"featureVersion": meta["featureVersion"], "cases": cases}, open(path + ".cases.json", "w"))
    print(f"wrote {len(cases)} parity cases to {path}.cases.json")


if __name__ == "__main__":
    main()
