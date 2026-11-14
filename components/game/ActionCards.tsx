"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePeek, type PeekCard } from "./peek";

export type ActionCardKind = "recruit" | "construct" | "propose" | "declare" | "free";

/** A special action shown as a card beside the hand (recruit, construct, free actions…). */
export type ActionCardSpec = {
  id: string;
  kind: ActionCardKind;
  title: string;
  /** One line on what it does; also the tooltip. */
  detail: string;
  /** Free actions show the card that grants them, and blow it up on hover or long-press. */
  art?: string;
  peek?: Omit<PeekCard, "anchorX">;
  /** Why it can't be used right now (the card stays visible, dimmed). */
  blockedReason?: string | null;
  /** Its mode is in progress (cards being chosen for it). */
  active?: boolean;
  onClick: () => void;
};

const KIND: Record<ActionCardKind, { tag: string | null; accent: string; icon: ReactNode }> = {
  recruit: { tag: null, accent: "#f0857a", icon: <FlagIcon /> },
  construct: { tag: null, accent: "#c6a56c", icon: <ColumnsIcon /> },
  propose: { tag: null, accent: "#8cc4ec", icon: <ScrollIcon /> },
  declare: { tag: "Victory", accent: "#f5c76b", icon: <CrownIcon /> },
  free: { tag: "Free action", accent: "#6ee7a8", icon: <BoltIcon /> },
};

type ActionCardsProps = {
  cards: readonly ActionCardSpec[];
  /** "hand": beside the hand on wide screens; "strip": a compact row on phones. */
  variant: "hand" | "strip";
};

export function ActionCards({ cards, variant }: ActionCardsProps) {
  // Touch has no hover tooltips: tapping a dimmed card says why it can't be used.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (cards.length === 0) return null;
  return (
    <div className="relative" data-tour="action-cards">
      {notice ? (
        <p
          role="status"
          className={[
            "absolute z-20 rounded-lg bg-[#0d1117] px-2.5 py-1.5 text-xs text-stone-200 shadow-xl ring-1 ring-white/15",
            variant === "hand" ? "right-0 bottom-[calc(100%+1.1rem)] w-56" : "inset-x-2 bottom-[calc(100%+0.25rem)]",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}
      <ul
        aria-label="Special actions"
        className={variant === "hand" ? "flex items-end gap-2" : "flex items-end gap-1.5 overflow-x-auto px-2 pt-1.5 pb-1 [scrollbar-width:none]"}
      >
        {cards.map((card) => (
          <li key={card.id} className="shrink-0">
            <ActionCard
              card={card}
              variant={variant}
              onBlocked={() => setNotice(`${card.title}: ${card.blockedReason}`)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionCard({
  card,
  variant,
  onBlocked,
}: {
  card: ActionCardSpec;
  variant: ActionCardsProps["variant"];
  onBlocked: () => void;
}) {
  const kind = KIND[card.kind];
  const blocked = Boolean(card.blockedReason);
  const hint = blocked ? `${card.blockedReason}` : card.active ? `${card.detail} (tap again to cancel)` : card.detail;
  const width = variant === "hand" ? "w-[calc(var(--card-hand)*0.86)]" : "w-[3.6rem]";
  const { setPeek } = usePeek();
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const peek = card.peek;
  const showPeek = (element: HTMLElement) => {
    if (!peek) return;
    const box = element.getBoundingClientRect();
    setPeek({ ...peek, anchorX: box.left + box.width / 2 });
  };
  const clearPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  useEffect(() => clearPress, []);

  return (
    <button
      type="button"
      title={peek ? undefined : hint}
      aria-label={`${card.title}: ${hint}`}
      aria-pressed={card.active ? true : undefined}
      aria-disabled={blocked || undefined}
      onClick={() => {
        if (longPressed.current) {
          // The long press showed the card; don't also use it.
          longPressed.current = false;
          return;
        }
        if (peek) setPeek(null);
        if (blocked) onBlocked();
        else card.onClick();
      }}
      onMouseEnter={peek ? (event) => showPeek(event.currentTarget) : undefined}
      onMouseLeave={peek ? () => setPeek(null) : undefined}
      onPointerDown={
        peek
          ? (event) => {
              longPressed.current = false;
              if (event.pointerType === "mouse") return;
              const target = event.currentTarget;
              clearPress();
              pressTimer.current = window.setTimeout(() => {
                longPressed.current = true;
                showPeek(target);
              }, 420);
            }
          : undefined
      }
      onPointerUp={peek ? clearPress : undefined}
      onPointerCancel={peek ? clearPress : undefined}
      onContextMenu={peek ? (event) => event.preventDefault() : undefined}
      style={{ "--accent": kind.accent } as CSSProperties}
      className={[
        "group relative block aspect-[825/1125] overflow-hidden rounded-[0.45em] text-left transition duration-150",
        width,
        "bg-[radial-gradient(120%_80%_at_50%_0%,#232b38_0%,#10141b_70%)]",
        "shadow-[0_0_0_2px_var(--accent),0_0_0_4px_#0b0e13,0_0_0_5px_color-mix(in_srgb,var(--accent)_45%,transparent),0_8px_18px_rgba(0,0,0,0.55)]",
        blocked
          ? "cursor-not-allowed opacity-45 saturate-50"
          : card.active
            ? "cursor-pointer -translate-y-3 shadow-[0_0_0_2px_var(--accent),0_0_0_4px_#0b0e13,0_0_0_5px_var(--accent),0_0_22px_color-mix(in_srgb,var(--accent)_70%,transparent)]"
            : "cursor-pointer hover:-translate-y-2 hover:shadow-[0_0_0_2px_var(--accent),0_0_0_4px_#0b0e13,0_0_0_5px_var(--accent),0_0_16px_color-mix(in_srgb,var(--accent)_55%,transparent)]",
      ].join(" ")}
    >
      {card.art ? (
        // eslint-disable-next-line @next/next/no-img-element -- small decorative crop of a card already on screen
        <img src={card.art} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-55" />
      ) : null}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/85" />

      {/* Title first: on wide screens the bottom of the card sits below the edge, like the hand. */}
      <span className="relative flex h-full flex-col items-center gap-[6%] p-[7%] text-center">
        {kind.tag ? (
          <span
            className="w-full truncate rounded-sm py-px text-[0.42rem] leading-tight font-bold tracking-[0.1em] uppercase"
            style={{ color: kind.accent, background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}
          >
            {kind.tag}
          </span>
        ) : null}
        <span
          className={[
            "w-full leading-[1.1] font-semibold text-stone-50 [text-shadow:0_1px_3px_#000]",
            variant === "hand" ? "text-[0.66rem]" : "text-[0.5rem]",
          ].join(" ")}
        >
          {card.title}
        </span>
        {card.art ? null : (
          <span aria-hidden className="mt-[4%] w-[44%] text-[var(--accent)] drop-shadow-[0_0_8px_var(--accent)]">
            {kind.icon}
          </span>
        )}
      </span>
    </button>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-5 9 5" fill="currentColor" fillOpacity="0.25" />
      <path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 21h18" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h11v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h11v1a3 3 0 0 0 3 3" fill="currentColor" fillOpacity="0.2" />
      <path d="M7 4a2 2 0 0 0-2 2v10M10 8h5M10 12h5" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}
