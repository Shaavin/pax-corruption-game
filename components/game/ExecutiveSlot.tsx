"use client";

import { CardView } from "./CardView";
import { resolveCard } from "./layout-fixture";
import type { ExecutiveSideId } from "@/lib/cards/schema";

type ExecutiveSlotProps = {
  side: ExecutiveSideId | null;
  align?: "start" | "end";
  playable?: boolean;
  selected?: boolean;
  title?: string;
  onSelect?: () => void;
};

export function ExecutiveSlot({
  side,
  align = "end",
  playable = false,
  selected = false,
  title = "Executive power. Playable on your turn, but it is not a hand card.",
  onSelect,
}: ExecutiveSlotProps) {
  if (!side) return null;
  const card = resolveCard(side);

  return (
    <div
      className={[
        "flex shrink-0 flex-col gap-0.5 px-2",
        align === "start" ? "self-start items-start" : "self-end items-end",
      ].join(" ")}
      title={title}
    >
      <div className="exalted-frame">
        <CardView
          name={card.name}
          art={card.art}
          size="hand"
          playable={playable}
          selected={selected}
          selectLabel={playable ? `Use ${card.name}` : undefined}
          onSelect={onSelect}
        />
      </div>
      <span className="text-[0.5rem] font-semibold tracking-[0.14em] text-[var(--brass)] uppercase">
        Executive
      </span>
    </div>
  );
}
