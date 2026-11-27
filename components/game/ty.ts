"use client";

import { setTyEvaluator, tyEvaluatorLoaded } from "@/lib/game/ai";
import { EVALUATOR_PATH, EXPANSION_EVALUATOR_PATH, loadNet } from "@/lib/game/ai-net";

let loading: Promise<void> | null = null;

async function fetchNet(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return loadNet(await response.arrayBuffer());
}

/**
 * Fetch Ty's trained evaluators (public/ai, saved for offline play by the service worker),
 * once: the main one and its Legacy & Diplomacy specialist. Resolves either way: without the main
 * one, Ty plays as Hard; without the specialist, the main one plays the expansion if it
 * learned it.
 */
export function loadTy(): Promise<void> {
  if (tyEvaluatorLoaded()) return Promise.resolve();
  loading ??= Promise.all([
    fetchNet(EVALUATOR_PATH),
    fetchNet(EXPANSION_EVALUATOR_PATH).catch((error: unknown) => {
      console.warn("Ty's Legacy & Diplomacy evaluator didn't load.", error);
      return null;
    }),
  ])
    .then(([net, expansion]) => setTyEvaluator(net, { expansion }))
    .catch((error: unknown) => {
      console.warn("Ty's evaluator didn't load; it plays as Hard.", error);
      loading = null;
    });
  return loading;
}
