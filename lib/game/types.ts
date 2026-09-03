import type {
  DistrictId,
  ExecutiveSideId,
  PartyIdValue,
  PolicyIdValue,
  SymbolId,
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

export const VictoryKind = {
  Military: "military",
  Popularity: "popularity",
  Ideological: "ideological",
} as const;
export type VictoryKindId = (typeof VictoryKind)[keyof typeof VictoryKind];

export type Victory = {
  kind: VictoryKindId;
  player: PlayerId;
  district?: DistrictId;
  symbol?: SymbolId;
};

/** In-progress Call Policy Referendum (and later, election-end referendums). */
export type ReferendumState = {
  districtIndex: number;
  awaitingChoice: boolean;
  chooser: PlayerId;
  options: Array<PolicyIdValue | null>;
  support: [number, number];
};

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
  currentTurn: LastTurn;
  flags: Record<string, boolean>;
  referendum: ReferendumState | null;
  victory: Victory | null;
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

export type PlayAllianceAction = {
  type: "playAlliance";
  player: PlayerId;
  instanceId: string;
};

export type PlayConspiracyAction = {
  type: "playConspiracy";
  player: PlayerId;
  instanceId: string;
};

export type RecruitAction = {
  type: "recruit";
  player: PlayerId;
  instanceIds: string[];
};

export type ConstructAction = {
  type: "construct";
  player: PlayerId;
  instanceIds: string[];
  monumentInstanceId: string;
};

export type CallReferendumAction = {
  type: "callReferendum";
  player: PlayerId;
  instanceIds: string[];
};

export type ChoosePolicyAction = {
  type: "choosePolicy";
  player: PlayerId;
  district: DistrictId;
  /** `null` is Neutral. */
  policyId: PolicyIdValue | null;
};

export type CampaignAction = {
  type: "campaign";
  player: PlayerId;
  instanceId: string;
};

export type EndPoliticsAction = {
  type: "endPolitics";
  player: PlayerId;
};

/** Legal during the action step only when no main action is available. */
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
  | PlayAllianceAction
  | PlayConspiracyAction
  | RecruitAction
  | ConstructAction
  | CallReferendumAction
  | ChoosePolicyAction
  | CampaignAction
  | EndPoliticsAction
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
  | {
      type: "alliancePlayed";
      player: PlayerId;
      instanceId: string;
      cardId: string;
      district: DistrictId;
    }
  | {
      type: "conspiracyPlayed";
      player: PlayerId;
      instanceId: string;
      cardId: string;
      district: DistrictId;
    }
  | {
      type: "cardDiscarded";
      player: PlayerId;
      instanceId: string;
      cardId: string;
      district: DistrictId;
      pileOwner: PlayerId;
    }
  | {
      type: "partisansRecruited";
      player: PlayerId;
      count: number;
    }
  | {
      type: "monumentConstructed";
      player: PlayerId;
      instanceId: string;
      cardId: string;
    }
  | { type: "monumentReplenished"; cardId: string }
  | {
      type: "campaignTucked";
      player: PlayerId;
      instanceId: string;
      cardId: string;
    }
  | { type: "politicsStarted"; player: PlayerId }
  | { type: "referendumStarted"; player: PlayerId }
  | {
      type: "districtSupportRevealed";
      district: DistrictId;
      support: [number, number];
    }
  | {
      type: "policyChoiceNeeded";
      district: DistrictId;
      player: PlayerId;
    }
  | {
      type: "policyChanged";
      district: DistrictId;
      policyId: PolicyIdValue | null;
      player: PlayerId;
    }
  | { type: "policyUnchanged"; district: DistrictId }
  | { type: "referendumEnded" }
  | { type: "victory"; victory: Victory }
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
