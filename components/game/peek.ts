"use client";

import { createContext, useContext } from "react";

export type PeekRelatedCard = {
  name: string;
  art: string;
  cardId?: string;
};

export type PeekCard = {
  name: string;
  art: string;
  cardId?: string;
  contents?: PeekRelatedCard[];
  contentsLabel?: string;
  /** Decrees: whether the active side is in effect (defaults to which art is shown). */
  decreeActive?: boolean;
  /** Viewport x of the hovered element's center; the zoom opens on the other half. */
  anchorX?: number;
};

type PeekContextValue = {
  setPeek: (card: PeekCard | null) => void;
};

export const PeekContext = createContext<PeekContextValue>({
  setPeek: () => {},
});

export function usePeek() {
  return useContext(PeekContext);
}
