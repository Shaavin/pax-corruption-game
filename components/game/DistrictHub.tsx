"use client";

import Image from "next/image";
import { CardBack, CardView } from "./CardView";
import { resolveCard } from "./layout-fixture";
import {
  type DistrictId,
  type PolicyIdValue,
} from "@/lib/cards/schema";

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
};

export function DistrictHub({
  district,
  policyId,
  yourSupport,
  theirSupport,
}: DistrictHubProps) {
  const delta = yourSupport - theirSupport;
  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
  const policy = policyId ? resolveCard(policyId) : null;

  return (
    <section
      className="flex flex-col items-center gap-0.5 border-x border-white/6 px-1 py-1"
      aria-label={`${DISTRICT_LABEL[district]} district`}
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
        className="grid w-full grid-cols-[auto_minmax(0.75rem,1fr)_auto_minmax(0.75rem,1fr)_auto] items-end gap-y-0.5 px-2.5"
        data-tour="support"
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
        <span
          data-tour="delta"
          className={[
            "col-start-3 row-start-2 justify-self-center text-sm font-semibold tabular-nums",
            delta > 0
              ? "text-emerald-300"
              : delta < 0
                ? "text-rose-300"
                : "text-stone-400",
          ].join(" ")}
        >
          Δ {deltaLabel}
        </span>
        <div className="col-start-5 row-start-2 justify-self-end">
          <PileCaption label="You" count={yourSupport} />
        </div>
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

function SupportStack({ count }: { count: number }) {
  const shown = Math.min(count, 3);
  return (
    <div className="relative h-12 w-8">
      {count === 0 ? (
        <div className="absolute inset-x-0 bottom-0 h-9 rounded-sm border border-dashed border-white/20" />
      ) : (
        Array.from({ length: shown }, (_, index) => (
          <div
            key={index}
            className="absolute inset-x-0 overflow-hidden rounded-[0.12em] shadow-sm ring-1 ring-black/50"
            style={{
              bottom: index * 4,
              height: "2.35rem",
              zIndex: index + 1,
            }}
          >
            <Image
              src={CardBack.common}
              alt=""
              fill
              sizes="32px"
              className="object-cover"
              draggable={false}
            />
          </div>
        ))
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
