import { DISTRICTS, type DistrictId, type PartyIdValue, type PolicyIdValue } from "@/lib/cards/schema";
import { meetsDecree } from "@/lib/game/decrees";
import { senateTotalVotes, senateVotesNeeded } from "@/lib/game/senate";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@/lib/game/types";
import { otherPlayer } from "@/lib/game/zones";
import type { DecreeView } from "./SenateRow";

export type TablePlayerView = {
  hand: CardInstance[];
  tableau: PlayerState["tableau"];
  support: Record<DistrictId, number>;
  /** Consultative Office + Planet Next bank: face-up, usable as if in hand. */
  setAside: CardInstance[];
  /** Planet Next banked cards (+1 Horsard influence each). */
  bank: number;
  partyId: PartyIdValue | null;
  monuments: string[];
  partisans: number;
  electionWins: number;
};

export type TableModel = {
  districtOrder: DistrictId[];
  policies: Record<DistrictId, PolicyIdValue | null>;
  you: TablePlayerView;
  opponent: TablePlayerView;
  senate: CardInstance[];
  senateVotes: number;
  senateVotesNeeded: number;
  decrees: DecreeView[];
  market: CardInstance[];
  availableMonuments: CardInstance[];
  deckCount: number;
  electionsOut: number;
  electionActive: boolean;
};

export function tableModel(state: GameState, viewer: PlayerId): TableModel {
  const opponentId = otherPlayer(viewer);
  const inPlay = state.phase !== "setup";
  return {
    districtOrder: state.districtOrder,
    policies: state.policy,
    you: playerView(state, viewer, true),
    opponent: playerView(state, opponentId, false),
    senate: state.senate,
    senateVotes: senateTotalVotes(state),
    senateVotesNeeded: senateVotesNeeded(state),
    decrees: state.decrees.map((decree) => ({
      id: decree.id,
      active: decree.active,
      youMeet: inPlay && decree.active && meetsDecree(state, viewer, decree.id),
      theyMeet: inPlay && decree.active && meetsDecree(state, opponentId, decree.id),
    })),
    market: state.market,
    availableMonuments: state.availableMonuments,
    deckCount: state.deck.length,
    electionsOut: state.electionsOut.length,
    electionActive: state.election.active,
  };
}

function playerView(state: GameState, player: PlayerId, isYou: boolean): TablePlayerView {
  const seat = state.players[player];
  const partyId = isYou
    ? (seat.partyId ?? state.setup?.chosenParty[player] ?? null)
    : seat.partyId;
  return {
    hand: isYou ? seat.hand.map((card) => ({ ...card, faceUp: true })) : seat.hand,
    tableau: seat.tableau,
    support: Object.fromEntries(
      DISTRICTS.map((district) => [district, seat.support[district].length]),
    ) as Record<DistrictId, number>,
    setAside: [...seat.consultativeOffice, ...seat.planetNextBank],
    bank: seat.planetNextBank.length,
    partyId,
    monuments: seat.monuments.map((card) => card.cardId),
    partisans: seat.partisans,
    electionWins: seat.electionWins,
  };
}
