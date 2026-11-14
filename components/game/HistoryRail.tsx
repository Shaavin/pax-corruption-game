"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CardBack, CardView } from "./CardView";
import { usePlayerLabel, usePlayerNames } from "./players";
import { usePeek } from "./peek";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, type DistrictId } from "@/lib/cards/schema";
import {
  ActionLogKind,
  buildActionLog,
  logCardBack,
  type ActionLogCard,
  type ActionLogEntry,
} from "@/lib/game/action-log";
import type { GameEvent, PlayerId } from "@/lib/game";

const DISTRICT_TONE: Record<DistrictId, string> = {
  dragonara: "bg-[var(--dragonara)]",
  horsard: "bg-[var(--horsard)]",
  shavvinne: "bg-[var(--shavvinne)]",
  smarbbit: "bg-[var(--smarbbit)]",
};

const BACK_SRC = {
  common: CardBack.common,
  monument: CardBack.monument,
  party: CardBack.party,
} as const;

const KIND_GLYPH: Partial<Record<ActionLogEntry["kind"], string>> = {
  [ActionLogKind.Recruit]: "⚔",
  [ActionLogKind.Election]: "✦",
  [ActionLogKind.Proposal]: "⚖",
  [ActionLogKind.Victory]: "★",
};

type HistoryRailProps = {
  events: readonly GameEvent[];
  viewer: PlayerId;
};

/**
 * Hearthstone-style history: a column of recent actions on the left edge,
 * newest at the bottom, tinted by who acted. Hover or click a tile for details.
 */
export function HistoryRail({ events, viewer }: HistoryRailProps) {
  const names = usePlayerNames();
  const entries = useMemo(() => buildActionLog(events, viewer, names), [events, viewer, names]);
  const listRef = useRef<HTMLOListElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const labelId = useId();
  const { setPeek } = usePeek();
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewTop, setPreviewTop] = useState(40);
  const activeId = pinnedId ?? hoveredId;
  const active = entries.find((entry) => entry.id === activeId) ?? null;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries.length]);

  useEffect(() => {
    if (!pinnedId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPinnedId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinnedId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinnedId]);

  function showEntry(entry: ActionLogEntry, tile: HTMLElement) {
    const root = rootRef.current;
    if (!root) return;
    setPeek(null);
    const tileBox = tile.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    const maxTop = Math.max(8, rootBox.height - 300);
    setPreviewTop(Math.max(8, Math.min(tileBox.top - rootBox.top - 12, maxTop)));
    setHoveredId(entry.id);
  }

  return (
    <aside
      ref={rootRef}
      aria-labelledby={labelId}
      data-tour="history"
      className="relative z-20 flex h-full w-14 shrink-0 flex-col border-r border-[var(--line)] bg-black/30"
    >
      <div id={labelId} className="label shrink-0 py-2 text-center">
        Log
      </div>
      <ol
        ref={listRef}
        role="log"
        className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-x-hidden overflow-y-auto px-1.5 pb-2 [scrollbar-width:none]"
      >
        {entries.length === 0 ? (
          <li className="mt-2 px-1 text-center text-[0.55rem] leading-tight text-stone-500">
            Nothing yet
          </li>
        ) : null}
        {entries.map((entry, index) => {
          const open = activeId === entry.id;
          const newest = index === entries.length - 1;
          return (
            <li key={entry.id} className={newest ? "rise-in" : undefined}>
              <button
                type="button"
                aria-label={entry.summary}
                aria-expanded={open}
                className="relative block cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--act)]"
                onMouseEnter={(event) => showEntry(entry, event.currentTarget)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={(event) => showEntry(entry, event.currentTarget)}
                onBlur={() => setHoveredId(null)}
                onClick={() => setPinnedId((current) => (current === entry.id ? null : entry.id))}
              >
                <LogTile entry={entry} viewer={viewer} active={open} />
              </button>
            </li>
          );
        })}
      </ol>
      {active ? <LogPreview entry={active} top={previewTop} viewer={viewer} /> : null}
    </aside>
  );
}

function seatColor(player: PlayerId | null, viewer: PlayerId): string {
  if (player === null) return "var(--act)";
  return player === viewer ? "var(--you)" : "var(--opp)";
}

function LogTile({ entry, viewer, active }: { entry: ActionLogEntry; viewer: PlayerId; active: boolean }) {
  const color = seatColor(entry.player, viewer);
  return (
    <span
      className="relative block h-10 w-10 overflow-hidden rounded-lg bg-stone-900 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      style={{ boxShadow: `0 0 0 ${active ? 2 : 1.5}px ${color}` }}
    >
      <TileFace entry={entry} />
      {KIND_GLYPH[entry.kind] && entry.primary ? (
        <span className="absolute right-0 bottom-0 z-10 rounded-tl-md bg-black/75 px-1 text-[0.55rem] leading-tight text-stone-100">
          {KIND_GLYPH[entry.kind]}
        </span>
      ) : null}
    </span>
  );
}

function TileFace({ entry }: { entry: ActionLogEntry }) {
  if (!entry.primary) {
    const tone =
      entry.kind === ActionLogKind.Victory
        ? "bg-[var(--act)]/25 text-[var(--act)]"
        : entry.district
          ? `${DISTRICT_TONE[entry.district]} text-stone-950`
          : "bg-white/8 text-stone-200";
    return (
      <span className={`flex h-full w-full items-center justify-center text-base ${tone}`}>
        {KIND_GLYPH[entry.kind] ?? "•"}
      </span>
    );
  }
  return <CroppedArt card={entry.primary} />;
}

function CroppedArt({ card }: { card: ActionLogCard }) {
  const def = getCard(card.cardId);
  const src = card.faceUp ? def.art : BACK_SRC[logCardBack(card.cardId)];
  return (
    <Image
      src={src}
      alt={card.faceUp ? def.name : "Facedown card"}
      fill
      sizes="40px"
      className="object-cover object-[50%_20%]"
      draggable={false}
    />
  );
}

function LogPreview({ entry, top, viewer }: { entry: ActionLogEntry; top: number; viewer: PlayerId }) {
  const playerLabel = usePlayerLabel();
  const related = entry.related.filter(
    (card, index) => card.faceUp && !(entry.primary && index === 0 && card.cardId === entry.primary.cardId),
  );
  const actor = entry.player === null ? "Table" : entry.player === viewer ? "You" : playerLabel(entry.player);

  return (
    <div
      role="tooltip"
      className="rise-in pointer-events-none absolute top-0 left-full z-30 ml-2 w-max max-w-[min(26rem,calc(100vw-6rem))]"
      style={{ transform: `translateY(${top}px)` }}
    >
      <div className="glass-strong rounded-2xl p-3 shadow-[0_18px_48px_rgba(0,0,0,0.7)]">
        <p className="label" style={{ color: seatColor(entry.player, viewer) }}>
          {actor}
        </p>
        <p className="mt-1 mb-2 max-w-72 text-sm leading-snug text-stone-100">{entry.summary}</p>
        <div className="flex flex-wrap items-end gap-2">
          {entry.primary ? (
            <CardView
              name={entry.primary.faceUp ? getCard(entry.primary.cardId).name : "Facedown card"}
              art={getCard(entry.primary.cardId).art}
              faceUp={entry.primary.faceUp}
              back={BACK_SRC[logCardBack(entry.primary.cardId)]}
              size="choice"
              square={getCard(entry.primary.cardId).kind === CardKind.Decree}
              cardId={entry.primary.faceUp ? entry.primary.cardId : undefined}
            />
          ) : null}
          {related.length > 0 ? (
            <div className="flex flex-col gap-1">
              {entry.relatedLabel ? <div className="label">{entry.relatedLabel}</div> : null}
              <div className="flex max-w-60 flex-wrap gap-1">
                {related.map((card, index) => {
                  const def = getCard(card.cardId);
                  return (
                    <CardView
                      key={`${entry.id}-${card.cardId}-${index}`}
                      name={def.name}
                      art={def.art}
                      size="mini"
                      cardId={card.cardId}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
