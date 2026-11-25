"use client";

import { ninthEvaluatorLoaded, setNinthEvaluator } from "@/lib/game/ai";
import { EVALUATOR_PATH, EXPANSION_EVALUATOR_PATH, loadNet } from "@/lib/game/ai-net";

let loading: Promise<void> | null = null;

async function fetchNet(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return loadNet(await response.arrayBuffer());
}

/**
 * Fetch The Ninth's trained evaluators (public/ai, saved for offline play by the service worker),
 * once: the main one and its Legacy & Diplomacy specialist. Resolves either way: without the main
 * one, The Ninth plays as Hard; without the specialist, the main one plays the expansion if it
 * learned it.
 */
export function loadNinth(): Promise<void> {
  if (ninthEvaluatorLoaded()) return Promise.resolve();
  loading ??= Promise.all([
    fetchNet(EVALUATOR_PATH),
    fetchNet(EXPANSION_EVALUATOR_PATH).catch((error: unknown) => {
      console.warn("The Ninth's Legacy & Diplomacy evaluator didn't load.", error);
      return null;
    }),
  ])
    .then(([net, expansion]) => setNinthEvaluator(net, { expansion }))
    .catch((error: unknown) => {
      console.warn("The Ninth's evaluator didn't load; it plays as Hard.", error);
      loading = null;
    });
  return loading;
}
