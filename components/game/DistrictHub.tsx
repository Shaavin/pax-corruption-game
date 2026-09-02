"use client";

import Image from "next/image";
import { CardBack, CardView } from "./CardView";
import { InfoTip } from "./InfoTip";
import { resolveCard } from "./layout-fixture";
import {
  type DistrictId,
  type PolicyIdValue,
} from "@/lib/cards/schema";
import type { DistrictInfluence } from "@/lib/game/influence";

const DISTRICT_LABEL: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

const DISTRICT_TONE: Record<DistrictId, string> = {
  dragonara: "bg-[var(--dragonara)]/80 text-stone-900",
  horsard: "bg-[var(--horsard)]/85 text-stone-900",
  shavvinne: "bg-[var(--shavvinne)]/85 text-stone-900",
  smarbbit: "bg-[var(--smarbbit)]/85 text-stone-900",
};

type DistrictHubProps = {
  district: DistrictId;
  policyId: PolicyIdValue | null;
  yourSupport: number;
  theirSupport: number;
  yourInfluence: DistrictInfluence;
  theirInfluence: DistrictInfluence;
};

export function DistrictHub({
  district,
  policyId,
  yourSupport,
  theirSupport,
  yourInfluence,
  theirInfluence,
}: DistrictHubProps) {
  const supportLead = yourSupport - theirSupport;
  const influenceLead = yourInfluence.total - theirInfluence.total;
  const policy = policyId ? resolveCard(policyId) : null;

  return (
    <section
      className="flex flex-col items-center gap-0.5 border-x border-white/6 px-1 py-1"
      aria-label={`${DISTRICT_LABEL[district]} district. Influence you ${yourInfluence.total}, opponent ${theirInfluence.total}. Popularity you ${yourSupport}, opponent ${theirSupport}.`}
    >
      <div
        className={[
          "w-full rounded-sm px-1.5 py-0.5 text-center text-[0.65rem] font-semibold tracking-[0.14em] uppercase",
          DISTRICT_TONE[district],
        ].join(" ")}
      >
        {DISTRICT_LABEL[district]}
      </div>

      <div
        data-tour="support"
        className="grid w-full grid-cols-[auto_minmax(0.75rem,1fr)_auto_minmax(0.75rem,1fr)_auto] items-end gap-y-0.5 px-2.5"
      >
        <div className="col-start-1 row-start-1 justify-self-start">
          <SupportStack count={theirSupport} />
        </div>
        <div className="col-start-3 row-start-1 justify-self-center">
          {policy ? (
            <CardView name={policy.name} art={policy.art} size="mini" />
          ) : (
            <div className="flex aspect-[825/1125] w-[var(--card-mini)] items-center justify-center rounded-[0.22em] border border-dashed border-[var(--brass)]/50 bg-black/25 text-[0.6rem] font-medium tracking-wide text-[var(--brass)]">
              Neutral
            </div>
          )}
        </div>
        <div className="col-start-5 row-start-1 justify-self-end">
          <SupportStack count={yourSupport} />
        </div>
        <div className="col-start-1 row-start-2 justify-self-start">
          <PileCaption label="Opp" count={theirSupport} />
        </div>
        <div className="col-start-5 row-start-2 justify-self-end">
          <PileCaption label="You" count={yourSupport} />
        </div>
      </div>

      <div
        data-tour="district-influence"
        className="flex flex-col items-center leading-none"
      >
        <div className="flex items-center gap-1">
          <span className="text-[0.55rem] font-semibold tracking-[0.16em] text-[var(--brass)] uppercase">
            Influence
          </span>
          <InfoTip label="What influence means">
            Elections compare these totals. Each civil card in this district
            adds its printed number; each card in your support pile adds 1.
            Alliances do not count unless a card says so. The score on the
            table is yours minus theirs.
            <span className="mt-1.5 block text-stone-400">
              You {yourInfluence.total} ({yourInfluence.civil} civil +{" "}
              {yourInfluence.support} support). Opponent {theirInfluence.total}{" "}
              ({theirInfluence.civil} civil + {theirInfluence.support} support).
            </span>
          </InfoTip>
        </div>
        <span
          className={[
            "mt-0.5 text-sm font-semibold tabular-nums",
            leadTone(influenceLead),
          ].join(" ")}
        >
          {signed(influenceLead)}
        </span>
      </div>

      <div
        data-tour="popularity"
        className="flex flex-col items-center leading-none"
      >
        <div className="flex items-center gap-1">
          <span className="text-[0.5rem] font-semibold tracking-[0.14em] text-stone-500 uppercase">
            Popularity
          </span>
          <InfoTip label="What popularity means">
            This is your support-pile count minus theirs. If you lead by 9 or
            more in any one district, you win Popularity immediately. The Opp /
            You numbers under the stacks are those pile sizes.
          </InfoTip>
        </div>
        <span
          className={[
            "mt-0.5 text-sm font-semibold tabular-nums",
            leadTone(supportLead),
          ].join(" ")}
        >
          {signed(supportLead)}
        </span>
      </div>

      <div
        data-tour="electors"
        className="text-[0.55rem] tracking-[0.12em] text-stone-500 uppercase"
      >
        Electors —
      </div>
    </section>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function leadTone(n: number): string {
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-rose-300";
  return "text-stone-400";
}

function SupportStack({ count }: { count: number }) {
  const shown = Math.min(count, 3);
  const peek = 4;
  return (
    <div className="relative w-[1.7rem]">
      {count === 0 ? (
        <div className="aspect-[825/1125] w-full rounded-[0.22em] border border-dashed border-white/20" />
      ) : (
        <>
          <div
            className="aspect-[825/1125] w-full"
            style={{ marginBottom: (shown - 1) * peek }}
            aria-hidden
          />
          {Array.from({ length: shown }, (_, index) => (
            <div
              key={index}
              className="absolute inset-x-0 aspect-[825/1125] overflow-hidden rounded-[0.22em] shadow-sm ring-1 ring-black/50"
              style={{
                bottom: index * peek,
                zIndex: index + 1,
              }}
            >
              <Image
                src={CardBack.common}
                alt=""
                fill
                sizes="28px"
                className="object-cover"
                draggable={false}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function PileCaption({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-baseline gap-1 leading-none">
      <span className="text-[0.5rem] font-semibold tracking-[0.1em] text-stone-500 uppercase">
        {label}
      </span>
      <span className="text-[0.7rem] font-semibold tabular-nums text-stone-200">
        {count}
      </span>
    </span>
  );
}
