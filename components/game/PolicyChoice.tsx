"use client";

import { CardView } from "./CardView";
import { getCard } from "@/lib/cards/catalog";
import type { DistrictId, PolicyIdValue } from "@/lib/cards/schema";
import type { ChoosePolicyAction } from "@/lib/game";

const DISTRICT_LABEL: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

type PolicyChoiceProps = {
  district: DistrictId;
  support: [number, number];
  chooserIsYou: boolean;
  options: Array<PolicyIdValue | null>;
  onChoose: (action: Pick<ChoosePolicyAction, "district" | "policyId">) => void;
};

export function PolicyChoice({
  district,
  support,
  chooserIsYou,
  options,
  onChoose,
}: PolicyChoiceProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="pointer-events-auto max-h-[min(92dvh,52rem)] w-full max-w-3xl overflow-y-auto rounded-xl bg-[#221c16] px-5 py-6 text-center shadow-2xl ring-1 ring-white/10">
        <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
          Policy referendum
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-100">
          {DISTRICT_LABEL[district]}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-300">
          Support {support[0]} – {support[1]}.{" "}
          {chooserIsYou
            ? "You must change this district’s policy."
            : "Waiting for the other player to choose."}
        </p>
        {chooserIsYou ? (
          <div className="mt-5 flex flex-wrap items-end justify-center gap-4">
            {options.map((policyId) => {
              if (policyId === null) {
                return (
                  <button
                    key="neutral"
                    type="button"
                    className="flex cursor-pointer flex-col items-center gap-2"
                    onClick={() => onChoose({ district, policyId: null })}
                  >
                    <div className="flex aspect-[825/1125] w-[var(--card-choice)] items-center justify-center rounded-[0.22em] border border-dashed border-[var(--brass)]/60 bg-black/30 text-sm font-semibold tracking-[0.14em] text-[var(--brass)] uppercase">
                      Neutral
                    </div>
                    <span className="text-sm text-stone-200">Neutral</span>
                  </button>
                );
              }
              const policy = getCard(policyId);
              return (
                <div key={policyId} className="flex flex-col items-center gap-2">
                  <CardView
                    name={policy.name}
                    art={policy.art}
                    size="choice"
                    cardId={policyId}
                    selectLabel={`Set ${DISTRICT_LABEL[district]} to ${policy.name}`}
                    onSelect={() => onChoose({ district, policyId })}
                  />
                  <span className="text-sm text-stone-200">{policy.name}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
