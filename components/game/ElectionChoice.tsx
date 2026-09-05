"use client";

import { CardView } from "./CardView";
import { playerLabel } from "./players";
import { getCard } from "@/lib/cards/catalog";
import { ExecutiveSide, type ExecutiveSideId } from "@/lib/cards/schema";
import type { PlayerId } from "@/lib/game";

type FirstPlayerProps = {
  kind: "firstPlayer";
  chooserIsYou: boolean;
  onChoose: (firstPlayer: PlayerId) => void;
};

type ExecutiveSideProps = {
  kind: "executiveSide";
  chooserIsYou: boolean;
  onChoose: (side: ExecutiveSideId) => void;
};

type ElectionChoiceProps = FirstPlayerProps | ExecutiveSideProps;

export function ElectionChoice(props: ElectionChoiceProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="pointer-events-auto max-w-3xl rounded-xl bg-[#221c16] px-5 py-6 text-center shadow-2xl ring-1 ring-white/10">
        {props.kind === "firstPlayer" ? (
          <FirstPlayerChoice {...props} />
        ) : (
          <ExecutiveSideChoice {...props} />
        )}
      </div>
    </div>
  );
}

function FirstPlayerChoice({
  chooserIsYou,
  onChoose,
}: Omit<FirstPlayerProps, "kind">) {
  return (
    <>
      <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
        Election
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-100">
        Who goes first?
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-300">
        {chooserIsYou
          ? "You lost the last election. Choose who takes the first turn of this one."
          : "Waiting for the opposition to choose who goes first."}
      </p>
      {chooserIsYou ? (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {([0, 1] as const).map((player) => (
            <button
              key={player}
              type="button"
              className="cursor-pointer rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-stone-950 hover:bg-[#d4b57c]"
              onClick={() => onChoose(player)}
            >
              {playerLabel(player)}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function ExecutiveSideChoice({
  chooserIsYou,
  onChoose,
}: Omit<ExecutiveSideProps, "kind">) {
  const sides: ExecutiveSideId[] = [
    ExecutiveSide.EmergencyState,
    ExecutiveSide.LegalReview,
  ];
  return (
    <>
      <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">
        Election won
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-100">
        Choose executive power
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-stone-300">
        {chooserIsYou
          ? "Take Executive Power and choose which side faces up."
          : "Waiting for the winner to choose an executive side."}
      </p>
      {chooserIsYou ? (
        <div className="mt-5 flex flex-wrap items-end justify-center gap-4">
          {sides.map((side) => {
            const card = getCard(side);
            return (
              <div key={side} className="flex flex-col items-center gap-2">
                <CardView
                  name={card.name}
                  art={card.art}
                  size="choice"
                  cardId={side}
                  selectLabel={`Take ${card.name}`}
                  onSelect={() => onChoose(side)}
                />
                <span className="text-sm text-stone-200">{card.name}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
