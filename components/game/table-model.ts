import { DISTRICTS, type DistrictId, type PartyIdValue, type PolicyIdValue } from "@/lib/cards/schema";
import type {
  CardInstance,
  ExecutiveHolder,
  GameState,
  PlayerId,
  PlayerState,
} from "@/lib/game/types";
import { otherPlayer } from "@/lib/game/zones";

export type TablePlayerView = {
  hand: CardInstance[];
  tableau: PlayerState["tableau"];
  support: Record<DistrictId, number>;
  policySupporters: number;
  policySupporterCards: CardInstance[];
  office: CardInstance[];
  partyId: PartyIdValue | null;
  monuments: string[];
  partisans: number;
  executive: ExecutiveHolder["side"] | null;
};

export type TableModel = {
  districtOrder: DistrictId[];
  policies: Record<DistrictId, PolicyIdValue | null>;
  you: TablePlayerView;
  opponent: TablePlayerView;
  market: CardInstance[];
  availableMonuments: CardInstance[];
  deckCount: number;
  electionsOut: number;
};

export function tableModel(state: GameState, viewer: PlayerId): TableModel {
  const opponentId = otherPlayer(viewer);
  return {
    districtOrder: state.districtOrder,
    policies: state.policy,
    you: playerView(state, viewer, true),
    opponent: playerView(state, opponentId, false),
    market: state.market,
    availableMonuments: state.availableMonuments,
    deckCount: state.deck.length,
    electionsOut: state.electionsOut.length,
  };
}

function playerView(
  state: GameState,
  player: PlayerId,
  isYou: boolean,
): TablePlayerView {
  const seat = state.players[player];
  const partyId = isYou
    ? (seat.partyId ?? state.setup?.chosenParty[player] ?? null)
    : seat.partyId;
  return {
    hand: isYou
      ? seat.hand.map((card) => ({ ...card, faceUp: true }))
      : seat.hand,
    tableau: seat.tableau,
    support: Object.fromEntries(
      DISTRICTS.map((district) => [district, seat.support[district].length]),
    ) as Record<DistrictId, number>,
    policySupporters: seat.policySupporters.length,
    policySupporterCards: isYou ? seat.policySupporters : [],
    office: seat.consultativeOffice,
    partyId,
    monuments: seat.monuments.map((card) => card.cardId),
    partisans: seat.partisans,
    executive:
      state.executive?.owner === player ? state.executive.side : null,
  };
}
