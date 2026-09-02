"use client";

import Image from "next/image";
import { usePeek } from "./peek";

export const CardBack = {
  common: "/cards/backs/common.png",
  monument: "/cards/backs/monument.png",
  party: "/cards/backs/party.png",
  district: "/cards/backs/district.png",
} as const;

export type CardSize = "hand" | "board" | "market" | "mini" | "zoom" | "choice";

const WIDTH: Record<CardSize, string> = {
  hand: "w-[var(--card-hand)]",
  board: "w-[var(--card-board)]",
  market: "w-[var(--card-market)]",
  mini: "w-[var(--card-mini)]",
  zoom: "w-[var(--card-zoom)]",
  choice: "w-[var(--card-choice)]",
};

const SIZES: Record<CardSize, string> = {
  hand: "90px",
  board: "70px",
  market: "80px",
  mini: "56px",
  zoom: "280px",
  choice: "168px",
};

type CardViewProps = {
  name: string;
  art: string;
  faceUp?: boolean;
  back?: string;
  size: CardSize;
  className?: string;
  selected?: boolean;
  onSelect?: () => void;
};

export function CardView({
  name,
  art,
  faceUp = true,
  back = CardBack.common,
  size,
  className = "",
  selected = false,
  onSelect,
}: CardViewProps) {
  const { setPeek } = usePeek();
  const src = faceUp ? art : back;
  const label = faceUp ? name : "Facedown card";
  const canPeek = faceUp && size !== "zoom";
  const frameClass = [
    "relative block shrink-0 overflow-hidden rounded-[0.22em] bg-stone-900 shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-1 ring-black/40",
    "aspect-[825/1125]",
    WIDTH[size],
    canPeek || onSelect
      ? "cursor-pointer transition-transform duration-150 hover:-translate-y-1 hover:z-20 hover:shadow-[0_8px_20px_rgba(0,0,0,0.55)] focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)]"
      : "",
    canPeek && !onSelect ? "cursor-zoom-in" : "",
    selected ? "ring-2 ring-[var(--brass)] ring-offset-2 ring-offset-[#16120e]" : "",
    className,
  ].join(" ");

  const image = (
    <Image
      src={src}
      alt={label}
      fill
      sizes={SIZES[size]}
      className="object-cover"
      unoptimized={src.endsWith(".svg")}
      draggable={false}
    />
  );

  if (!canPeek) {
    return (
      <div className={frameClass} role="img" aria-label={label}>
        {image}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Inspect ${name}`}
      className={frameClass}
      onMouseEnter={() => setPeek({ name, art })}
      onMouseLeave={() => setPeek(null)}
      onFocus={() => setPeek({ name, art })}
      onBlur={() => setPeek(null)}
    >
      {image}
    </button>
  );
}
