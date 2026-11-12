"use client";

import { CardView } from "./CardView";
import { InfoTip } from "./InfoTip";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, type DecreeIdValue } from "@/lib/cards/schema";
import { senatorVotes } from "@/lib/game/senate";
import type { CardInstance } from "@/lib/game/types";

export type DecreeView = {
  id: DecreeIdValue;
  active: boolean;
  youMeet: boolean;
  theyMeet: boolean;
};

type SenateRowProps = {
  senate: CardInstance[];
  totalVotes: number;
  votesNeeded: number;
  /** Senate indexes the current reveal convinces (Propose Policy). */
  convinced?: ReadonlySet<number>;
  /** Votes the current reveal gathers, while proposing. */
  revealVotes?: number | null;
  decrees: DecreeView[];
};

export function SenateRow({
  senate,
  totalVotes,
  votesNeeded,
  convinced,
  revealVotes = null,
  decrees,
}: SenateRowProps) {
  return (
    <section
      className="flex shrink-0 items-center justify-between gap-4 border-t border-white/8 bg-black/20 px-3 py-1"
      aria-label="Senate and decree objectives"
    >
      <div className="flex min-w-0 items-center gap-2" data-tour="senate">
        <div className="shrink-0 leading-tight">
          <div className="flex items-center gap-1">
            <span className="text-[0.6rem] font-semibold tracking-[0.16em] text-stone-400 uppercase">
              Senate
            </span>
            <InfoTip label="How the Senate works">
              Civil and conspiracy Senators carry 1 vote, alliances 2. To pass a
              policy, reveal cards from your hand that convince more than half of
              the votes: a higher civil card of the same district, or another
              alliance of the same district. Conspiracies are never convinced.
            </InfoTip>
          </div>
          <div
            className={[
              "text-[0.65rem] tabular-nums",
              revealVotes !== null && revealVotes >= votesNeeded
                ? "font-semibold text-emerald-300"
                : "text-stone-300",
            ].join(" ")}
          >
            {revealVotes !== null
              ? `${revealVotes} / ${votesNeeded} needed`
              : `${totalVotes} votes · ${votesNeeded} to pass`}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {senate.map((entry, index) => {
            const def = getCard(entry.cardId);
            const votes = senatorVotes(entry.cardId);
            const isConvinced = convinced?.has(index) ?? false;
            return (
              <div key={entry.instanceId} className="relative">
                <CardView
                  name={def.name}
                  art={def.art}
                  size="mini"
                  cardId={entry.cardId}
                  selected={isConvinced}
                  dimmed={convinced !== undefined && !isConvinced}
                />
                <span
                  className={[
                    "pointer-events-none absolute -right-1 -bottom-1 rounded px-1 text-[0.6rem] font-semibold tabular-nums ring-1",
                    def.kind === CardKind.Alliance
                      ? "bg-[var(--brass)] text-stone-950 ring-black/40"
                      : "bg-stone-900 text-stone-100 ring-white/20",
                  ].join(" ")}
                  title={`${votes} vote${votes === 1 ? "" : "s"}`}
                >
                  {votes}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2" data-tour="decrees">
        <div className="flex items-center gap-1">
          <span className="text-[0.6rem] font-semibold tracking-[0.16em] text-stone-400 uppercase">
            Decrees
          </span>
          <InfoTip label="Decree objectives">
            Each election winner activates one inactive decree per General
            Election set aside. Active decrees count as shared symbols, and
            meeting two active decrees at once lets you declare Political
            Victory. Dots show who meets each active decree right now.
          </InfoTip>
        </div>
        {decrees.map((decree) => {
          const def = getCard(decree.id);
          if (def.kind !== CardKind.Decree) return null;
          return (
            <div key={decree.id} className="flex flex-col items-center gap-0.5">
              <CardView
                name={decree.active ? def.name : def.inactiveName}
                art={decree.active ? def.art : def.inactiveArt}
                size="mini"
                cardId={decree.id}
                square
                dimmed={!decree.active}
              />
              {decree.active ? (
                <span className="flex gap-1 text-[0.5rem] font-semibold tracking-[0.08em] uppercase">
                  <span className={decree.theyMeet ? "text-rose-300" : "text-stone-600"}>Opp</span>
                  <span className={decree.youMeet ? "text-emerald-300" : "text-stone-600"}>You</span>
                </span>
              ) : (
                <span className="text-[0.5rem] tracking-[0.08em] text-stone-500 uppercase">Inactive</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
