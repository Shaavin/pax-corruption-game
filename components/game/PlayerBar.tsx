"use client";

import { useNotice } from "./notice";
import type { ReactNode } from "react";
import { CardBack, CardView } from "./CardView";
import { resolveCard, type FixtureCard } from "./layout-fixture";
import { NetworkIcon } from "./NetworkIcon";
import type { PartyIdValue } from "@/lib/cards/schema";

type PlayerBarProps = {
  seat: "you" | "opponent";
  name: string;
  partyId: PartyIdValue | null;
  monuments: readonly string[];
  /** Their network (face up): shown in a bordered, labelled group. Yours sits beside your hand. */
  network: FixtureCard[];
  electionWins: number;
  /** Wins a tied election: the last election's winner (the first player before any). */
  incumbent?: boolean;
  /** Electorates this player would win if the election were scored now (of 5). */
  electorates: number;
  /** Council of Lords handshake symbols in play. */
  lords: number;
  /** Who holds the Council of Lords (more Lords symbols; a tie gives it to nobody). */
  lordsLead?: "lead" | "tie" | "behind";
  active: boolean;
  /** Phone layout: tighter spacing, smaller labels. */
  compact?: boolean;
  /** Phone layout: the opponent's hand as a count instead of fanned backs. */
  handCount?: number;
  children?: ReactNode;
};

/** Portrait strip for one seat: party, monuments, and the numbers that win games. */
export function PlayerBar({
  seat,
  name,
  partyId,
  monuments,
  network,
  electionWins,
  incumbent = false,
  electorates,
  lords,
  lordsLead,
  active,
  compact = false,
  handCount,
  children,
}: PlayerBarProps) {
  const color = seat === "you" ? "var(--you)" : "var(--opp)";
  const party = partyId ? resolveCard(partyId) : null;

  return (
    <div
      data-tour={seat === "you" ? "your-party" : undefined}
      className={["flex min-w-0 items-center", compact ? "w-full gap-1.5 min-[360px]:gap-2.5" : "gap-3"].join(" ")}
    >
      {/* On phones the name and party shorten (…) before the numbers get pushed off-screen. */}
      <div className={["flex items-center", compact ? "min-w-[4.5rem] shrink gap-1.5 min-[360px]:gap-2" : "shrink-0 gap-2"].join(" ")}>
        <div className="relative">
          {party ? (
            <CardView name={party.name} art={party.art} back={CardBack.party} size="mini" cardId={partyId ?? undefined} />
          ) : (
            <div className="flex aspect-[825/1125] w-[var(--card-mini)] items-center justify-center rounded-[0.32em] border border-dashed border-white/15 text-[0.45rem] text-stone-500 uppercase">
              Party
            </div>
          )}
          {active ? (
            <span
              className="absolute -inset-1 -z-10 rounded-lg opacity-70 blur-[6px]"
              style={{ background: color }}
              aria-hidden
            />
          ) : null}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span className={["truncate font-semibold whitespace-nowrap text-stone-100", compact ? "text-xs" : "text-sm"].join(" ")}>
              {name}
            </span>
          </div>
          <div className={["text-[0.6rem] tracking-wide whitespace-nowrap text-stone-400", compact ? "truncate" : ""].join(" ")}>
            {/* Phones: the badge takes the party name's place (the party card beside it shows the party). */}
            {compact && incumbent ? null : party ? party.name : "Choosing a party"}
            {incumbent ? <IncumbentBadge electionWon={electionWins > 0} compact={compact} /> : null}
            {active ? (
              <span className="ml-1.5 font-semibold" style={{ color }}>
                · {seat === "you" ? "Your turn" : "Their turn"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl
        className={["flex shrink-0 items-center", compact ? "gap-1.5 min-[400px]:gap-2" : "gap-2 xl:gap-3"].join(" ")}
        data-tour={seat === "you" ? "partisans" : undefined}
      >
        {handCount !== undefined ? <Stat label="Hand" value={handCount} title="Hand: cards in their hand." /> : null}
        <Stat label="Wins" value={electionWins} title="Wins: elections won so far." />
        <Stat
          label="Lords"
          value={lords}
          title={`Lords: alliance handshake symbols in play. More than the other player wins the Council of Lords, the 5th electorate.${
            lordsLead === "lead"
              ? ` ${seat === "you" ? "You hold" : "They hold"} it now.`
              : lordsLead === "tie"
                ? " Tied now: nobody holds it."
                : ""
          }`}
          // Boxed like a district plate: ringed in the color of whoever holds the Council.
          box={lordsLead === undefined ? undefined : { color: lordsLead === "lead" ? color : null }}
          color={lordsLead === "lead" ? color : undefined}
        />
        <Stat
          label="Electorates"
          value={`${electorates}/5`}
          title="Electorates: how many of the 5 (4 districts + Council of Lords) this player would win if the election were scored now."
          color={electorates >= 3 ? color : undefined}
        />
        {/* Cultural Victory lives in the Monuments section, Diplomatic in the World section. */}
      </dl>

      {monuments.length + network.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1">
          {monuments.map((id) => {
            const monument = resolveCard(id);
            return (
              <CardView
                key={id}
                name={monument.name}
                art={monument.art}
                back={CardBack.monument}
                size="mini"
                cardId={id}
                motionKey={`monument:${id}`}
              />
            );
          })}
          {network.length > 0 ? (
            <div
              role="group"
              aria-label={`${seat === "you" ? "Your" : "Their"} network, ${network.length} ${network.length === 1 ? "card" : "cards"}`}
              title="Network: revealed cards outside the hand limit, usable as if in hand"
              className="relative ml-1 flex items-center gap-1 rounded-md border px-1 pt-2 pb-0.5"
              style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }}
            >
              <span
                className="absolute -top-1.5 left-1 flex items-center gap-0.5 rounded-full bg-[rgb(12_15_20)] px-1 text-[0.45rem] leading-[0.7rem] font-bold tracking-[0.08em] uppercase"
                style={{ color }}
              >
                <NetworkIcon className="size-2" />
                Network
              </span>
              {network.map((entry) => {
                const card = resolveCard(entry.cardId);
                return (
                  <CardView
                    key={entry.instanceId}
                    name={card.name}
                    art={card.art}
                    size="mini"
                    cardId={entry.cardId}
                    motionKey={entry.instanceId}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  title,
  color,
  box,
}: {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  color?: string;
  /** A plate-style box: ringed and tinted in `color`, or a neutral ring when null. */
  box?: { color: string | null };
}) {
  const notify = useNotice();
  // Tapping a number explains it (touch screens have no hover tooltips).
  return (
    <div
      className={[
        "text-center leading-none",
        title ? "cursor-help" : "",
        // Padding cancelled by negative margin: the box never widens the row (phones have no room).
        box ? "-mx-0.5 -my-1 rounded-md px-0.5 py-1 transition-[box-shadow,background-color] duration-300 min-[400px]:-mx-1.5 min-[400px]:px-1.5" : "",
      ].join(" ")}
      style={
        box
          ? {
              boxShadow: `0 0 0 1px ${box.color ?? "rgb(255 255 255 / 0.12)"}`,
              background: box.color ? `color-mix(in srgb, ${box.color} 12%, transparent)` : undefined,
            }
          : undefined
      }
      title={title}
      onClick={title ? () => notify(title) : undefined}
    >
      {/* Narrow phones: tighter letter-spacing so every label fits whole. */}
      <dt className="label !text-[0.5rem] max-[400px]:!tracking-[0.06em]">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-stone-100" style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
  );
}

/** Marks the player who wins a tied election, with a tap or hover note on why. */
function IncumbentBadge({ electionWon, compact }: { electionWon: boolean; compact: boolean }) {
  const notify = useNotice();
  const text = electionWon
    ? "Incumbent: won the last election. If an election ends tied on electorates and on cards in them, the incumbent wins it."
    : "Incumbent: no election has been won yet, so the first player holds this. If an election ends tied on electorates and on cards in them, the incumbent wins it.";
  return (
    <button
      type="button"
      onClick={() => notify(text)}
      title={text}
      aria-label={text}
      className={[
        compact ? "" : "ml-1.5",
        "relative cursor-help rounded-full bg-[var(--brass)]/15 px-1.5 align-[0.05em] font-semibold tracking-[0.08em] whitespace-nowrap text-[var(--brass)] uppercase ring-1 ring-[var(--brass)]/40 after:absolute after:-inset-2 after:content-['']",
        // Narrow phones: a touch smaller, so it fits whole beside the party card.
        "text-[0.5rem] max-[400px]:px-1 max-[400px]:text-[0.45rem] max-[400px]:tracking-[0.02em]",
      ].join(" ")}
    >
      Incumbent
    </button>
  );
}
