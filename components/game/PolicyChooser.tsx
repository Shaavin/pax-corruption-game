"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { CardView } from "./CardView";
import { getCard, POLICIES } from "@/lib/cards/catalog";
import type { DistrictId, PolicyIdValue } from "@/lib/cards/schema";

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

export type PolicyChoice = { district: DistrictId; policyId: PolicyIdValue | null };

type PolicyChooserProps = {
  districtOrder: readonly DistrictId[];
  policies: Record<DistrictId, PolicyIdValue | null>;
  /** Districts a District Governor protects from proposals. */
  frozen: Record<DistrictId, boolean>;
  /** Null to look only (from the board, or before the reveal passes). */
  onChoose: ((choice: PolicyChoice) => void) | null;
  /** Scrolls to and outlines this district (opened from its plate). */
  focus?: DistrictId | null;
  onClose: () => void;
};

/** Changes a proposal may make: Neutral → either side, a side → Neutral. */
function allowedChanges(district: DistrictId, current: PolicyIdValue | null): (PolicyIdValue | null)[] {
  if (current !== null) return [null];
  return POLICIES.filter((policy) => policy.district === district).map((policy) => policy.id);
}

/** Every district's policy beside the ones it could change to. Cards zoom on hover or long-press. */
export function PolicyChooser({ districtOrder, policies, frozen, onChoose, focus = null, onClose }: PolicyChooserProps) {
  const focusRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  const cardSize = { "--card-choice": "clamp(84px, 22vw, 128px)" } as CSSProperties;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 px-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-chooser-title"
        className="rise-in glass-strong max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl px-4 py-4 shadow-2xl sm:px-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="policy-chooser-title" className="text-lg font-semibold text-stone-100">
              {onChoose ? "Choose a policy to change" : "District policies"}
            </h2>
            <p className="mt-0.5 text-xs text-stone-400">
              A proposal moves one policy from Neutral to a side, or from a side back to Neutral.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-lg text-stone-400 hover:bg-white/8 hover:text-stone-100"
          >
            ×
          </button>
        </div>

        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2" style={cardSize}>
          {districtOrder.map((district) => {
            const current = policies[district];
            const locked = frozen[district];
            const allowed = new Set(locked ? [] : allowedChanges(district, current));
            const options: (PolicyIdValue | null)[] = [
              ...POLICIES.filter((policy) => policy.district === district).map((policy) => policy.id),
              null,
            ];
            return (
              <li
                key={district}
                ref={district === focus ? focusRef : undefined}
                className={[
                  "rounded-xl border bg-white/[0.03] p-2.5",
                  district === focus ? "border-[var(--brass)]/60" : "border-white/[0.08]",
                ].join(" ")}
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-100">
                  <span aria-hidden className="h-3 w-1 rounded-full" style={{ background: `var(--${district})` }} />
                  {DISTRICT_NAME[district]}
                  {locked ? (
                    <span className="ml-auto text-[0.65rem] font-normal text-stone-400">Protected by District Governor</span>
                  ) : null}
                </h3>
                <div className="mt-2 flex items-start justify-center gap-2">
                  {options.map((policyId) => {
                    const inEffect = policyId === current;
                    const canChoose = !inEffect && allowed.has(policyId);
                    const name = policyId ? getCard(policyId).name : "Neutral";
                    return (
                      <div key={policyId ?? "neutral"} className="flex flex-col items-center gap-1.5">
                        <div className={["rounded-[0.4em]", inEffect ? "ring-2 ring-[var(--act)] ring-offset-2 ring-offset-[#11151c]" : ""].join(" ")}>
                          {policyId ? (
                            <CardView name={name} art={getCard(policyId).art} size="choice" cardId={policyId} />
                          ) : (
                            <div className="flex aspect-[825/1125] w-[calc(var(--card-choice)*0.62)] items-center justify-center rounded-[0.4em] border border-dashed border-white/20 text-xs text-stone-400">
                              Neutral
                            </div>
                          )}
                        </div>
                        {inEffect ? (
                          <span className="py-0.5 text-[0.6rem] font-semibold tracking-wide text-[var(--act)] uppercase">In effect</span>
                        ) : canChoose && onChoose ? (
                          <button
                            type="button"
                            aria-label={`Set ${DISTRICT_NAME[district]} to ${name}`}
                            onClick={() => onChoose({ district, policyId })}
                            className="cursor-pointer rounded-lg bg-[var(--act)] px-2.5 py-0.5 text-xs font-semibold text-stone-950 hover:brightness-110"
                          >
                            Choose
                          </button>
                        ) : (
                          <span className="py-0.5 text-[0.6rem] tracking-wide text-stone-500 uppercase">
                            {canChoose ? "Can change to" : locked ? "Locked" : "Neutral first"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
