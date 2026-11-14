"use client";

import { CardView } from "./CardView";
import { playerLabel } from "./players";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, type DecreeIdValue } from "@/lib/cards/schema";
import type { PlayerId } from "@/lib/game";

type DecreeChoiceProps = {
  winner: PlayerId;
  chooserIsYou: boolean;
  remaining: number;
  options: DecreeIdValue[];
  onChoose: (decreeId: DecreeIdValue) => void;
};

/** The election winner activates one inactive decree per General Election set aside. */
export function DecreeChoice({ winner, chooserIsYou, remaining, options, onChoose }: DecreeChoiceProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="pointer-events-auto max-w-3xl rounded-2xl glass-strong px-5 py-6 text-center shadow-2xl ring-1 ring-white/10">
        <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
          Election won
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-100">
          {chooserIsYou ? "Activate a decree" : `${playerLabel(winner)} activates a decree`}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-300">
          {chooserIsYou
            ? `Choose ${remaining === 1 ? "one decree" : `${remaining} decrees, one at a time`}. Its symbol becomes shared, and meeting two active decrees wins Political Victory. Tip: a decree matching your party's symbol helps your ideology.`
            : "Waiting for the election winner to choose."}
        </p>
        {chooserIsYou ? (
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            {options.map((decreeId) => {
              const def = getCard(decreeId);
              if (def.kind !== CardKind.Decree) return null;
              return (
                <div key={decreeId} className="flex flex-col items-center gap-1.5">
                  <CardView
                    name={def.name}
                    art={def.art}
                    size="choice"
                    square
                    cardId={decreeId}
                    playable
                    selectLabel={`Activate ${def.name}`}
                    peekExtra={{ decreeActive: false }}
                    onSelect={() => onChoose(decreeId)}
                  />
                  <span className="text-xs text-stone-300">{def.text}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
