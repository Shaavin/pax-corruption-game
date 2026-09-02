import type {
  DistrictId,
  ExecutiveSideId,
  PartyIdValue,
  PolicyIdValue,
} from "../cards/schema.ts";

export type PlayerId = 0 | 1;
export const PLAYERS: readonly PlayerId[] = [0, 1];

export const GameMode = {
  Standard: "standard",
} as const;
export type GameModeId = (typeof GameMode)[keyof typeof GameMode];

export const Phase = {
  Setup: "setup",
  Action: "action",
  Politics: "politics",
  Income: "income",
  ElectionStart: "electionStart",
  ElectionEnd: "electionEnd",
  GameOver: "gameOver",
} as const;
export type PhaseId = (typeof Phase)[keyof typeof Phase];

export const SetupStep = {
  ChooseParty: "chooseParty",
  ChooseStartingHand: "chooseStartingHand",
} as const;
export type SetupStepId = (typeof SetupStep)[keyof typeof SetupStep];

export type CardInstance = {
  instanceId: string;
  cardId: string;
  /** Public knowledge. A face-up hand card (market take) stays visible to the opponent. */
  faceUp: boolean;
  occupiedDistrict?: DistrictId;
};

export type PlayerState = {
  hand: CardInstance[];
  tableau: Record<DistrictId, CardInstance[]>;
  support: Record<DistrictId, CardInstance[]>;
  policySupporters: CardInstance[];
  consultativeOffice: CardInstance[];
  partyId: PartyIdValue | null;
  monuments: CardInstance[];
  partisans: number;
  handLimit: number;
  electionWins: number;
  consecutiveWins: number;
};

export type SetupState = {
  step: SetupStepId;
  dealtParties: Record<PlayerId, PartyIdValue[]>;
  chosenParty: Record<PlayerId, PartyIdValue | null>;
  startingOffers: Record<PlayerId, CardInstance[]>;
  nonElectionPool: CardInstance[];
  electionCards: CardInstance[];
};

export type LastTurn = {
  discarded: boolean;
  addedSupport: boolean;
};

export type ExecutiveHolder = {
  owner: PlayerId;
  side: ExecutiveSideId;
};

export type GameState = {
  mode: GameModeId;
  seed: number;
  phase: PhaseId;
  setup: SetupState | null;
  activePlayer: PlayerId;
  firstPlayer: PlayerId | null;
  electionTriggerer: PlayerId | null;
  players: [PlayerState, PlayerState];
  districtOrder: DistrictId[];
  policy: Record<DistrictId, PolicyIdValue | null>;
  market: CardInstance[];
  deck: CardInstance[];
  availableMonuments: CardInstance[];
  monumentDeck: CardInstance[];
  electionsOut: CardInstance[];
  unusedParties: PartyIdValue[];
  executive: ExecutiveHolder | null;
  lastTurn: LastTurn;
  flags: Record<string, boolean>;
};

export type ChoosePartyAction = {
  type: "chooseParty";
  player: PlayerId;
  partyId: PartyIdValue;
};

export type ChooseStartingHandAction = {
  type: "chooseStartingHand";
  player: PlayerId;
  instanceIds: string[];
};

export type PlayCivilAction = {
  type: "playCivil";
  player: PlayerId;
  instanceId: string;
};

/** Legal during the action step only when no civil card can be played (Phase 3 dummy turns). */
export type EndActionAction = {
  type: "endAction";
  player: PlayerId;
};

export type TakeMarketAction = {
  type: "takeMarket";
  player: PlayerId;
  instanceId: string;
};

export type Action =
  | ChoosePartyAction
  | ChooseStartingHandAction
  | PlayCivilAction
  | EndActionAction
  | TakeMarketAction;

export type GameEvent =
  | { type: "districtsShuffled"; order: DistrictId[] }
  | { type: "partiesDealt"; dealt: Record<PlayerId, PartyIdValue[]> }
  | { type: "partyChosen"; player: PlayerId; partyId: PartyIdValue }
  | {
      type: "partiesRevealed";
      parties: Record<PlayerId, PartyIdValue>;
      firstPlayer: PlayerId;
    }
  | {
      type: "startingHandTaken";
      player: PlayerId;
      instanceIds: string[];
    }
  | {
      type: "monumentsSet";
      available: string[];
      deck: string[];
    }
  | { type: "marketDealt"; cardIds: string[] }
  | { type: "deckBuilt"; size: number }
  | { type: "setupComplete"; firstPlayer: PlayerId }
  | {
      type: "civilPlayed";
      player: PlayerId;
      instanceId: string;
      cardId: string;
      district: DistrictId;
    }
  | { type: "incomeStarted"; player: PlayerId }
  | {
      type: "marketTaken";
      player: PlayerId;
      instanceId: string;
      cardId: string;
    }
  | { type: "cardDrawn"; player: PlayerId; cardId: string }
  | { type: "marketReplenished"; cardIds: string[] }
  | { type: "electionSetAside"; cardId: string }
  | { type: "turnEnded"; nextPlayer: PlayerId };

export type ApplyResult = {
  state: GameState;
  events: GameEvent[];
};
