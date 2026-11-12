import { DISTRICTS, type DecreeIdValue, type DistrictId, type PartyIdValue, type PolicyIdValue } from "@/lib/cards/schema";
import { meetsDecree } from "@/lib/game/decrees";
import { civilElectorsInDistrict, lordsSymbols, tallyElection } from "@/lib/game/election";
import { playerDistrictInfluence, type DistrictInfluence } from "@/lib/game/influence";
import { senateTotalVotes, senateVotesNeeded } from "@/lib/game/senate";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@/lib/game/types";
import { otherPlayer } from "@/lib/game/zones";
import type { PhaseStep } from "./SidePanel";

export type DecreeView = {
  id: DecreeIdValue;
  active: boolean;
  youMeet: boolean;
  theyMeet: boolean;
};

export type TablePlayerView = {
  id: PlayerId;
  hand: CardInstance[];
  tableau: PlayerState["tableau"];
  support: Record<DistrictId, number>;
  influence: Record<DistrictId, DistrictInfluence>;
  /** Consultative Office + Planet Next bank: face-up, usable as if in hand. */
  setAside: CardInstance[];
  partyId: PartyIdValue | null;
  monuments: string[];
  partisans: number;
  electionWins: number;
  /** Electorates this player would win if the election were scored now. */
  electorates: number;
  lords: number;
};

export type TableModel = {
  districtOrder: DistrictId[];
  policies: Record<DistrictId, PolicyIdValue | null>;
  you: TablePlayerView;
  opponent: TablePlayerView;
  activePlayer: PlayerId;
  phase: PhaseStep;
  senate: CardInstance[];
  senateVotes: number;
  senateVotesNeeded: number;
  decrees: DecreeView[];
  market: CardInstance[];
  availableMonuments: CardInstance[];
  deckCount: number;
  electionsOut: number;
  electionActive: boolean;
  /** Electors at stake per district (civil cards in play), during an election. */
  electors: Record<DistrictId, number> | null;
};

export function tableModel(state: GameState, viewer: PlayerId): TableModel {
  const opponentId = otherPlayer(viewer);
  const inPlay = state.phase !== "setup";
  const electorates = projectedElectorates(state);
  return {
    districtOrder: state.districtOrder,
    policies: state.policy,
    you: playerView(state, viewer, true, electorates[viewer]),
    opponent: playerView(state, opponentId, false, electorates[opponentId]),
    activePlayer: state.activePlayer,
    phase: phaseStep(state),
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
    electors: state.election.active
      ? (Object.fromEntries(
          DISTRICTS.map((district) => [district, civilElectorsInDistrict(state, district)]),
        ) as Record<DistrictId, number>)
      : null,
  };
}

function phaseStep(state: GameState): PhaseStep {
  switch (state.phase) {
    case "setup":
      return "setup";
    case "action":
      return "action";
    case "politics":
      return "politics";
    case "income":
      return "income";
    case "decreeChoice":
      return "decree";
    default:
      return "over";
  }
}

/** Electorates each player would take if the election were tallied right now. */
function projectedElectorates(state: GameState): [number, number] {
  if (state.phase === "setup" || state.firstPlayer === null) return [0, 0];
  return tallyElection(state).electorates;
}

function playerView(state: GameState, player: PlayerId, isYou: boolean, electorates: number): TablePlayerView {
  const seat = state.players[player];
  const partyId = isYou ? (seat.partyId ?? state.setup?.chosenParty[player] ?? null) : seat.partyId;
  return {
    id: player,
    hand: isYou ? seat.hand.map((card) => ({ ...card, faceUp: true })) : seat.hand,
    tableau: seat.tableau,
    support: Object.fromEntries(
      DISTRICTS.map((district) => [district, seat.support[district].length]),
    ) as Record<DistrictId, number>,
    influence: Object.fromEntries(
      DISTRICTS.map((district) => [district, playerDistrictInfluence(state, player, district)]),
    ) as Record<DistrictId, DistrictInfluence>,
    setAside: [...seat.consultativeOffice, ...seat.planetNextBank],
    partyId,
    monuments: seat.monuments.map((card) => card.cardId),
    partisans: seat.partisans,
    electionWins: seat.electionWins,
    electorates,
    lords: lordsSymbols(state, player),
  };
}
