# Training the learned evaluator

The strongest computer opponent judges positions with a small neural network instead of
hand-set weights. The rules stay in TypeScript (`lib/game`): Node plays the self-play games and
encodes positions; Python only learns from them. The trained weights run in the game in plain
TypeScript (`lib/game/ai-net.ts`), synchronously, with no runtime library.

| Piece | Where |
| --- | --- |
| A position as numbers, from one seat's view | `lib/game/ai-features.ts` (`FEATURE_VERSION` names the layout) |
| Self-play games → training data | `scripts/ai-selfplay.ts` |
| Training → weights | `training/train.py` (PyTorch, CPU) |
| The network in the game | `lib/game/ai-net.ts` (`loadNet`, `netEvaluator`) |
| Measuring | `scripts/ai-match.ts net:<weights.bin> hard 200` |

## Setup (once)

```sh
python -m venv training/.venv
training/.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
training/.venv/Scripts/python -m pip install numpy
```

(`training/.venv/bin/python` on macOS and Linux.) A CPU is enough: the network is small.

## One round

1. **Play.** Generate games, several runs in parallel with different `--from`. Each run saves its
   finished games (seed and moves) as `<dir>/g<from>-<to>.records.jsonl`:

   ```sh
   node --experimental-strip-types --no-warnings scripts/ai-selfplay.ts --out training/data/games1 --games 1500 --from 1 --players quick,quick
   ```

   Players: `easy`, `normal`, `hard`, `quick` (Hard's search for this turn only, fast),
   `quick:<agenda>` (the same, fixed on one agenda at full strength: `ideology`, `military`,
   `popularity`, `decrees`, `elections`, `monuments`, `diplomacy`), `net:<weights.bin>` (a trained
   evaluator in Hard's search), or `netquick:<weights.bin>` (the same for this turn only: fast
   enough to generate the next round's games). Either takes `@<agenda>[=lean]` to lean the
   evaluator toward one agenda (`netquick:<weights.bin>@ideology`; lean in the evaluator's units,
   100 per logit, default 100): a strong player taking a road the evaluator rarely tries, and a
   strong opponent defending against it. `ninth:<weights.bin>` plays as The Ninth does in the
   game (its whole search, replies judged by its evaluator): several times slower than
   `netquick:`, but its games are played as well as it can (for Legacy & Diplomacy, give the
   expansion network). `--explore` is the chance of a random move, so games differ.
   `--expansion` plays Legacy & Diplomacy (`--foreign`: with Foreign Influence).

   Mix the players. Games against `quick:<agenda>` opponents show every road to victory and the
   defence against it: without them the evaluator only learns the roads its own games take (the
   first rounds barely knew Ideological Victory, on either side). For Ideological Victory, lean
   the current evaluator hard: `netquick:<weights.bin>@ideology=600` wins about half its games
   against the plain evaluator, almost half of them by Ideology (its measure, `ideologyRoad` in
   `lib/game/ai-agenda.ts`, counts the copies still to be had and how ready its cards are to pass
   the last policy; a lighter lean, or one without readiness, seldom got the last copy). Train on base and expansion
   games together: one evaluator plays both, and its header records whether it learned the
   expansion (The Ninth plays expansion games as Hard until it has).

2. **Encode.** Replay the games into training positions with the current feature layout (a new
   layout only needs this step again, not new games):

   ```sh
   node --experimental-strip-types --no-warnings scripts/ai-encode.ts --out training/data/enc1 training/data/games1
   ```

3. **Train.**

   ```sh
   training/.venv/Scripts/python training/train.py --data training/data/enc1 --out training/runs/gen1.bin
   ```

   Positions are split into training and validation by game. It prints validation loss and
   accuracy (always against the games' results) per epoch, keeps the best epoch, and writes the
   weights plus `<out>.cases.json`, positions with the logit PyTorch gives them, which
   `lib/game/ai-net.test.ts` checks the TypeScript forward pass against.

   Positions from one game share its result, so a few thousand games are only a few thousand
   examples and the network soon memorizes them. With a previous evaluator, `--bootstrap
   <previous.bin>` trains on TD(λ) targets instead (as TD-Gammon did): each position's target
   leans on the previous evaluator's view of the seat's next position, the result reaching back
   by `--lam` (default 0.7). Far less luck in the targets, and no memorizing.

   Legacy & Diplomacy games are a minority of the data. `--expansion-weight N` shows their
   positions N times per epoch (a shard counts as expansion when most of its games are), and
   each epoch also prints validation on expansion games alone.

   `--aux-weight W` also teaches a training-only head how each game ends (who wins, and by
   which victory), from the results, read from the records each shard was encoded from: it
   shapes the hidden layers and isn't exported. Round 7 tried 0.5: no better than without.

4. **Measure.** Against Hard, a few hundred games (run several `--from` ranges in parallel):

   ```sh
   node --experimental-strip-types --no-warnings scripts/ai-match.ts ninth:training/runs/gen1.bin hard 40 --from 1
   ```

   `ninth:<weights.bin>` plays as The Ninth does in the game (`+noreply` predicts the opponent's
   reply with Hard's score instead of the evaluator, as before 2026-11-26). Two `ninth:` players
   can meet: head to head against the shipped pair is the measure that matters most (Hard is a
   weaker, narrower opponent than a strong player). Also measure against the Ideology
   specialist (`netquick:<weights.bin>@ideology=600`: does it see an Ideological Victory coming?
   Hard seldom wins that way, so it barely tests that) and with `--expansion`. A few hundred games
   tell apart only differences of 5 points or more: compare on the same deals (`--from`).
   Keep each process's memory down (`node --max-old-space-size=700 …`) and run only as many at
   once as memory allows; self-play saves each game as it finishes, so a run that is stopped can
   be started again with the same options and picks up where it was.

5. **Repeat** with games played by the new evaluator (`--players netquick:training/runs/gen1.bin,...`),
   training on the new games plus recent ones, bootstrapped from the last round. Each round's
   games are better than the last.

6. **Ship** a round that beats the shipped one: copy it to `public/ai/` with its `.cases.json`.
   There are two: `evaluator.bin` plays the base game and `evaluator-expansion.bin` plays Legacy &
   Diplomacy (`ai-match.ts ninth:<base.bin>+exp=<expansion.bin>` plays as the game does). One
   network for both played one of them worse: weighting the expansion up won more there and
   less in the base game. So train them apart on the same data: the base one with
   `--expansion-weight 0` (leaves expansion games out), the expansion one with
   `--expansion-weight 2`.

Generated data (`training/data/`), runs (`training/runs/`), and the virtual environment are not
committed. Changing `lib/game/ai-features.ts` means a new `FEATURE_VERSION`, encoding the records
again (step 2), and training again: weights trained on another layout are refused when loaded.
A layout that only appends dense features can keep bootstrapping from the last round:
`training/widen.py <old.bin> <new.bin> --version <new FEATURE_VERSION> --dense <count>` gives
the new features zero weights, so the widened evaluator judges every position as before (with
`--cases <encoded dir>` it also writes the parity cases, to ship it).
