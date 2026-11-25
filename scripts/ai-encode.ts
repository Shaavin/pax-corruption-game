/**
 * Turn self-play records (scripts/ai-selfplay.ts) into training positions for training/train.py:
 * each game is replayed, and positions along the way are encoded from both seats' points of view
 * (lib/game/ai-features.ts), labelled with whether that seat went on to win.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/ai-encode.ts --out <dir> [--sample P] <records.jsonl | dir> ...
 *
 * --sample is the share of positions kept (default 0.3), picked by a hash of the game and move,
 * so encoding the same records again picks the same positions. Files already encoded (their
 * summary exists) are skipped unless --again; positions are written game by game, so memory
 * stays small.
 *
 * Writes <dir>/<name>.{idx,off,dense,y,game,json} per records file: sparse feature indices
 * (uint16) with per-position offsets (uint32), dense features (float32), labels (uint8), game
 * numbers (uint32), and a summary naming the feature layout.
 */
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync, writeSync } from "node:fs";
import { basename, join } from "node:path";
import { DENSE_COUNT, encodeState, FEATURE_VERSION, SPARSE_COUNT } from "../lib/game/ai-features.ts";
import { newReplay, stepReplay } from "../lib/game/record.ts";
import type { Action, GameModeId, PlayerId } from "../lib/game/types.ts";

const args = process.argv.slice(2);
const take = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`);
  if (at < 0) return fallback;
  const [value] = args.splice(at, 2).slice(1);
  return value ?? fallback;
};
const out = take("out", "");
const sample = Number(take("sample", "0.3"));
const again = args.includes("--again");
if (again) args.splice(args.indexOf("--again"), 1);
if (!out || args.length === 0) {
  console.error("Usage: scripts/ai-encode.ts --out <dir> [--sample P] <records.jsonl | dir> ...");
  process.exit(1);
}
const files = args.flatMap((path) =>
  statSync(path).isDirectory()
    ? readdirSync(path).filter((name) => name.endsWith(".records.jsonl")).map((name) => join(path, name))
    : [path],
);

/** A fixed pick per game and move. */
function kept(game: number, step: number): boolean {
  let h = Math.imul(game ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(step + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 2 ** 32 < sample;
}

mkdirSync(out, { recursive: true });
for (const file of files) {
  const started = Date.now();
  // Written game by game, so memory stays small however many games a file holds. The summary
  // (.json) comes last: training only reads shards that have one.
  const base = join(out, basename(file).replace(/\.records\.jsonl$/, ""));
  // Already encoded (its summary is written last): skip, so an interrupted run picks up.
  if (existsSync(`${base}.json`) && !again) continue;
  const handles = {
    idx: openSync(`${base}.idx`, "w"),
    off: openSync(`${base}.off`, "w"),
    dense: openSync(`${base}.dense`, "w"),
    y: openSync(`${base}.y`, "w"),
    game: openSync(`${base}.game`, "w"),
  };
  let indices = 0;
  let positions = 0;
  writeSync(handles.off, new Uint32Array([0]));
  let games = 0;
  let expansionGames = 0;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record: { game: number; seed: number; mode?: GameModeId; expansion?: boolean; foreignInfluence?: boolean; winner: PlayerId; actions: Action[] };
    try {
      record = JSON.parse(line);
    } catch {
      // A game still being written (self-play may be running): the next encode picks it up.
      continue;
    }
    games++;
    if (record.expansion) expansionGames++;
    const idx: number[] = [];
    const off: number[] = [];
    const dense: number[] = [];
    const labels: number[] = [];
    let replay = newReplay(record.seed, { mode: record.mode ?? "standard", expansion: Boolean(record.expansion), foreignInfluence: Boolean(record.foreignInfluence) });
    record.actions.forEach((action, step) => {
      replay = stepReplay(replay, action);
      const state = replay.state;
      if (state.phase === "setup" || state.victory || !kept(record.game, step)) return;
      for (const seat of [0, 1] as const) {
        const features = encodeState(state, seat);
        for (const index of features.sparse) idx.push(index);
        off.push(indices + idx.length);
        for (const value of features.dense) dense.push(value);
        labels.push(record.winner === seat ? 1 : 0);
      }
    });
    writeSync(handles.idx, new Uint16Array(idx));
    writeSync(handles.off, new Uint32Array(off));
    writeSync(handles.dense, new Float32Array(dense));
    writeSync(handles.y, new Uint8Array(labels));
    writeSync(handles.game, new Uint32Array(labels.length).fill(record.game));
    indices += idx.length;
    positions += labels.length;
  }
  for (const handle of Object.values(handles)) closeSync(handle);
  const summary = { featureVersion: FEATURE_VERSION, sparseCount: SPARSE_COUNT, denseCount: DENSE_COUNT, records: file, games, expansionGames, positions, sample, seconds: Math.round((Date.now() - started) / 1000) };
  writeFileSync(`${base}.json`, JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary));
}
