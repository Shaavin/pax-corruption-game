/**
 * The computer's learned evaluator: a small neural network that reads a position (ai-features.ts)
 * and says how likely `seat` is to win. Trained by training/train.py on self-play games; run here
 * in plain TypeScript, synchronously, with no runtime library.
 *
 * Shape: the sparse features (on/off) each add a row of the first layer, like a chess engine's
 * NNUE, so a position costs a few hundred additions there; the dense features go through it as a
 * matrix. Then ReLU, a second layer, ReLU, and one output (a logit: above 0 favours `seat`).
 *
 * Weights file (little-endian): "PAXN", a uint32 header length, a JSON header padded to a
 * multiple of 4 bytes, then float32 arrays in order: sparse rows [sparse × h1], dense rows
 * [dense × h1], b1 [h1], w2 [h1 × h2], b2 [h2], w3 [h2], b3 [1].
 */
import { DENSE_COUNT, encodeState, FEATURE_VERSION, SPARSE_COUNT, type Features } from "./ai-features.ts";
import type { GameState, PlayerId } from "./types.ts";

/** The shipped evaluator, under `public/` (with its parity cases at `<path>.cases.json`). */
export const EVALUATOR_PATH = "/ai/evaluator.bin";
/**
 * The shipped Legacy & Diplomacy specialist (optional): one evaluator for both games plays one of
 * them worse, so the base game's and the expansion's can be trained apart.
 */
export const EXPANSION_EVALUATOR_PATH = "/ai/evaluator-expansion.bin";

export type NetHeader = {
  featureVersion: string;
  sparse: number;
  dense: number;
  hidden: [number, number];
  /** Trained on Legacy & Diplomacy games too (else it only knows the base game). */
  expansion?: boolean;
  /** Free-form notes from training (data, epochs, validation). */
  trained?: Record<string, unknown>;
};

export type Net = {
  header: NetHeader;
  sparseRows: Float32Array;
  denseRows: Float32Array;
  b1: Float32Array;
  w2: Float32Array;
  b2: Float32Array;
  w3: Float32Array;
  b3: number;
};

/** Read a weights file. Refuses one trained on another feature layout. */
export function loadNet(bytes: ArrayBuffer | Uint8Array): Net {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
  if (magic !== "PAXN") throw new Error("Not a Pax Corruption evaluator file");
  const headerLength = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(data.subarray(8, 8 + headerLength))) as NetHeader;
  if (header.featureVersion !== FEATURE_VERSION || header.sparse !== SPARSE_COUNT || header.dense !== DENSE_COUNT) {
    throw new Error(`Evaluator trained on ${header.featureVersion} (${header.sparse}+${header.dense}); this build encodes ${FEATURE_VERSION} (${SPARSE_COUNT}+${DENSE_COUNT})`);
  }
  const [h1, h2] = header.hidden;
  // Copy the floats into a fresh buffer: aligned, and not a view into a larger one (Node's file
  // reads share a pool, and Buffer#slice doesn't copy).
  const floats = new Float32Array(new Uint8Array(data.subarray(8 + headerLength)).buffer);
  let at = 0;
  const take = (count: number) => {
    const part = floats.subarray(at, at + count);
    at += count;
    return part;
  };
  const net: Net = {
    header,
    sparseRows: take(header.sparse * h1),
    denseRows: take(header.dense * h1),
    b1: take(h1),
    w2: take(h1 * h2),
    b2: take(h2),
    w3: take(h2),
    b3: take(1)[0]!,
  };
  if (at !== floats.length) throw new Error(`Evaluator file has ${floats.length} weights, expected ${at}`);
  return net;
}

/** The logit that `features`' seat wins (sigmoid of it is the probability). */
export function netLogit(net: Net, features: Features): number {
  const [h1, h2] = net.header.hidden;
  const hidden = new Float32Array(net.b1);
  for (const index of features.sparse) {
    const row = index * h1;
    for (let j = 0; j < h1; j++) hidden[j]! += net.sparseRows[row + j]!;
  }
  const dense = features.dense;
  for (let k = 0; k < dense.length; k++) {
    const value = dense[k]!;
    if (value === 0) continue;
    const row = k * h1;
    for (let j = 0; j < h1; j++) hidden[j]! += value * net.denseRows[row + j]!;
  }
  let logit = net.b3;
  for (let k = 0; k < h2; k++) {
    let sum = net.b2[k]!;
    for (let j = 0; j < h1; j++) {
      const value = hidden[j]!;
      if (value > 0) sum += value * net.w2[j * h2 + k]!;
    }
    if (sum > 0) logit += sum * net.w3[k]!;
  }
  return logit;
}

/** How likely `seat` is to win, by the network. */
export function winChance(net: Net, state: GameState, seat: PlayerId): number {
  if (state.victory) return state.victory.player === seat ? 1 : 0;
  return 1 / (1 + Math.exp(-netLogit(net, encodeState(state, seat))));
}

/** A search's judge of positions from the network: its logit, scaled; a won game ±1e6. */
export function netEvaluator(net: Net): (state: GameState, seat: PlayerId) => number {
  return (state, seat) => {
    if (state.victory) return state.victory.player === seat ? 1e6 : -1e6;
    return 100 * netLogit(net, encodeState(state, seat));
  };
}
