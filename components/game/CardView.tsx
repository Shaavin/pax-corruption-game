"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { usePeek } from "./peek";

export const CardBack = {
  common: "/cards/backs/common.png",
  monument: "/cards/backs/monument.png",
  party: "/cards/backs/party.png",
  district: "/cards/backs/district.png",
} as const;

export type CardSize =
  | "hand"
  | "board"
  | "market"
  | "mini"
  | "zoom"
  | "choice"
  | "related"
  | "relatedMonument";

const WIDTH: Record<CardSize, string> = {
  hand: "w-[var(--card-hand)]",
  board: "w-[var(--card-board)]",
  market: "w-[var(--card-market)]",
  mini: "w-[var(--card-mini)]",
  zoom: "w-[var(--card-zoom)]",
  choice: "w-[var(--card-choice)]",
  related: "w-[var(--card-related)]",
  relatedMonument: "w-[var(--card-related-monument)]",
};

const SIZES: Record<CardSize, string> = {
  hand: "90px",
  board: "70px",
  market: "80px",
  mini: "56px",
  zoom: "280px",
  choice: "168px",
  related: "140px",
  relatedMonument: "280px",
};

type CardViewProps = {
  name: string;
  art: string;
  faceUp?: boolean;
  back?: string;
  size: CardSize;
  className?: string;
  selected?: boolean;
  dimmed?: boolean;
  selectLabel?: string;
  onSelect?: () => void;
  cardId?: string;
  /** Ms before the inspect zoom appears. Choice cards default to a short delay. */
  peekDelay?: number;
};

const CHOICE_PEEK_DELAY_MS = 1250;

export function CardView({
  name,
  art,
  faceUp = true,
  back = CardBack.common,
  size,
  className = "",
  selected = false,
  dimmed = false,
  selectLabel,
  onSelect,
  cardId,
  peekDelay,
}: CardViewProps) {
  const { setPeek } = usePeek();
  const peekTimer = useRef<number | null>(null);
  const src = faceUp ? art : back;
  const label = faceUp ? name : "Facedown card";
  const canPeek = faceUp && size !== "zoom" && size !== "related" && size !== "relatedMonument";
  const interactive = canPeek || Boolean(onSelect);
  const inspectDelay =
    peekDelay ?? (size === "choice" ? CHOICE_PEEK_DELAY_MS : 0);
  const liftOnHover = size !== "choice";
  const frameClass = [
    "relative block shrink-0 overflow-hidden rounded-[0.22em] bg-stone-900 shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-1 ring-black/40",
    "aspect-[825/1125]",
    WIDTH[size],
    interactive
      ? [
          "cursor-pointer focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)]",
          liftOnHover
            ? "transition-transform duration-150 hover:-translate-y-1 hover:z-20 hover:shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
            : "",
        ].join(" ")
      : "",
    canPeek && !onSelect ? "cursor-zoom-in" : "",
    selected && !dimmed
      ? "ring-2 ring-[var(--brass)] ring-offset-2 ring-offset-[#16120e]"
      : "",
    className,
  ].join(" ");

  const image = (
    <Image
      src={src}
      alt={label}
      fill
      sizes={SIZES[size]}
      className={dimmed ? "object-cover opacity-55 grayscale" : "object-cover"}
      unoptimized={src.endsWith(".svg")}
      draggable={false}
    />
  );

  function clearPeekTimer() {
    if (peekTimer.current !== null) {
      window.clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  }

  function showPeek() {
    if (!canPeek) return;
    if (inspectDelay <= 0) {
      setPeek({ name, art, cardId });
      return;
    }
    clearPeekTimer();
    peekTimer.current = window.setTimeout(() => {
      setPeek({ name, art, cardId });
      peekTimer.current = null;
    }, inspectDelay);
  }

  function hidePeek() {
    clearPeekTimer();
    setPeek(null);
  }

  useEffect(() => {
    return () => {
      if (peekTimer.current !== null) {
        window.clearTimeout(peekTimer.current);
      }
    };
  }, []);

  if (!interactive) {
    return (
      <div className={frameClass} role="img" aria-label={label}>
        {image}
      </div>
    );
  }

  const ariaLabel = onSelect
    ? (selectLabel ?? (selected ? `Selected ${name}` : `Choose ${name}`))
    : `Inspect ${name}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={onSelect ? selected : undefined}
      className={frameClass}
      onClick={() => {
        hidePeek();
        onSelect?.();
      }}
      onMouseEnter={canPeek ? showPeek : undefined}
      onMouseLeave={canPeek ? hidePeek : undefined}
      onFocus={canPeek ? showPeek : undefined}
      onBlur={canPeek ? hidePeek : undefined}
    >
      {image}
    </button>
  );
}
