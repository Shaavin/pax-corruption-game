"use client";

import { useCallback, useEffect, useState } from "react";
import { ElectionResult, ElectionStart, type ElectionResultData, type ElectionStartData, type Seat } from "./ElectionMoment";
import { PartiesReveal, type PartiesRevealData } from "./PartiesMoment";
import { momentsOn } from "./moment-kit";
import { GENERAL_ELECTION_COUNT, VictoryKind, type GameEvent, type GameState, type PlayerId } from "@/lib/game";
import type { DistrictId } from "@/lib/cards/schema";

/** A turning point played over the table: the parties revealed, an election opening or counted. */
export type TableMomentData = PartiesRevealData | ElectionStartData | ElectionResultData;

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

/** The moments in a batch of new events. `state` is the position after them. */
function momentsFrom(fresh: readonly GameEvent[], state: GameState, firstId: number): TableMomentData[] {
  const moments: TableMomentData[] = [];
  let result: ElectionResultData | null = null;
  for (const event of fresh) {
    if (event.type === "partiesRevealed") {
      moments.push({ id: firstId + moments.length, kind: "parties", parties: event.parties, firstPlayer: event.firstPlayer });
    } else if (event.type === "electionTallied") {
      const seats: Seat[] | null = event.districts
        ? [
            ...state.districtOrder.map((district) => ({
              id: district,
              label: DISTRICT_NAME[district],
              color: `var(--${district})`,
              winner: event.districts?.[district] ?? null,
            })),
            { id: "lords", label: "Lords", color: "var(--brass)", winner: event.lords ?? null },
          ]
        : null;
      result = {
        id: firstId + moments.length,
        kind: "electionResult",
        winner: event.winner,
        electorates: event.electorates,
        electors: event.electors,
        tieBreak: event.tieBreak,
        seats,
        decrees: 0,
        civil: null,
        // A result followed by a new election in the same move can't be the last one.
        final: state.electionsOut.length >= GENERAL_ELECTION_COUNT && !state.election.active,
      };
      moments.push(result);
    } else if (event.type === "decreeChoiceNeeded" && result) {
      result.decrees = event.count;
    } else if (event.type === "victory" && result && event.victory.kind === VictoryKind.Civil) {
      result.civil = event.victory.player;
    } else if (event.type === "electionStarted") {
      moments.push({
        id: firstId + moments.length,
        kind: "electionStart",
        revealed: state.electionsOut.length,
        count: Math.max(1, state.election.generalElections),
        final: state.electionsOut.length >= GENERAL_ELECTION_COUNT,
        expansion: Boolean(state.expansion),
      });
    }
  }
  return moments;
}

type Queued = TableMomentData & {
  /** Shown to a seat that missed it (hotseat): no later change to the events on screen drops it. */
  missed?: true;
};

/**
 * Watches the events behind the position on screen and queues a moment for each turning point
 * among them. Events that disappear (Undo, or a hotseat replay going back to the start of the
 * other player's turn) clear the queue without playing anything, except moments queued with
 * `showMissed`.
 */
export function useTableMoments(events: readonly GameEvent[], state: GameState) {
  const [track, setTrack] = useState(() => ({ events, queue: [] as Queued[], nextId: 0 }));
  let current = track;
  if (track.events !== events) {
    const before = track.events.length;
    let queue = track.queue;
    let nextId = track.nextId;
    if (events.length < before) {
      queue = queue.filter((moment) => moment.missed);
    } else if (events.length > before && momentsOn()) {
      const added = momentsFrom(events.slice(before), state, nextId);
      queue = [...queue, ...added];
      nextId += added.length;
    }
    current = { events, queue, nextId };
    setTrack(current);
  }
  const done = useCallback(() => setTrack((value) => ({ ...value, queue: value.queue.slice(1) })), []);
  /**
   * Hotseat: play moments from events that happened while the other player held the device and
   * that no replay will show (the parties are revealed on the other player's setup move).
   */
  const showMissed = useCallback((missed: readonly GameEvent[], after: GameState) => {
    if (!momentsOn()) return;
    setTrack((value) => {
      const added: Queued[] = momentsFrom(missed, after, value.nextId).map((moment) => ({ ...moment, missed: true }));
      return added.length ? { ...value, queue: [...added, ...value.queue], nextId: value.nextId + added.length } : value;
    });
  }, []);
  return { moment: (current.queue[0] ?? null) as TableMomentData | null, done, showMissed };
}

/** The moment on screen. A click (or Escape, Enter, or Space) skips it. */
export function TableMoment({ moment, viewer, onDone }: { moment: TableMomentData; viewer: PlayerId; onDone: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onDone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  switch (moment.kind) {
    case "parties":
      return <PartiesReveal key={moment.id} moment={moment} viewer={viewer} onDone={onDone} />;
    case "electionStart":
      return <ElectionStart key={moment.id} moment={moment} onDone={onDone} />;
    case "electionResult":
      return <ElectionResult key={moment.id} moment={moment} viewer={viewer} onDone={onDone} />;
  }
}
