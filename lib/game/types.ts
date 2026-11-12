import type {
  DecreeIdValue,
  DistrictId,
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
  /** The election winner is choosing which decree objectives to activate. */
  DecreeChoice: "decreeChoice",
  GameOver: "gameOver",
} as const;
export type PhaseId = (typeof Phase)[keyof typeof Phase];

export const SetupStep = {
  ChooseParty: "chooseParty",
  ChooseStartingHand: "chooseStartingHand",
} as const;
export type SetupStepId = (typeof SetupStep)[keyof typeof SetupStep];

export const VictoryKind = {
  Civil: "civil",
  Political: "political",
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

export const ElectionTieBreak = {
  Electorates: "electorates",
  Electors: "electors",
  Incumbent: "incumbent",
  FirstPlayer: "firstPlayer",
} as const;
export type ElectionTieBreakId = (typeof ElectionTieBreak)[keyof typeof ElectionTieBreak];

export type ElectionRuntime = {
  /** From the moment a General Election is revealed until the election resolves. */
  active: boolean;
  /** Market still needs its one-time fill to 8 for the phase that just started. */
  needsOpening: boolean;
  /** General Elections set aside during this phase (= decrees to activate). */
  generalElections: number;
  /** Incumbent: winner of the previous election. */
  lastWinner: PlayerId | null;
};

export type DecreeState = {
  id: DecreeIdValue;
  active: boolean;
};

/** The election winner owes decree activations before the next turn starts. */
export type PendingDecrees = {
  player: PlayerId;
  remaining: number;
  /** Whose turn comes next once the choices are made (normal alternation). */
  nextPlayer: PlayerId;
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
  /** Consultative Office (Smarbbit policy): face-up, usable as if in hand. */
  consultativeOffice: CardInstance[];
  /** Planet Next (monument): banked Horsard cards, +1 Horsard influence each. */
  planetNextBank: CardInstance[];
  partyId: PartyIdValue | null;
  monuments: CardInstance[];
  partisans: number;
  handLimit: number;
  electionWins: number;
};

export type SetupState = {
  step: SetupStepId;
  dealtParties: Record<PlayerId, PartyIdValue[]>;
  chosenParty: Record<PlayerId, PartyIdValue | null>;
  startingOffers: Record<PlayerId, CardInstance[]>;
  nonElectionPool: CardInstance[];
  electionCards: CardInstance[];
};

export type TurnState = {
  /** A monument was constructed this turn (Politics step starts with a draw). */
  constructedMonument: boolean;
};

export type GameState = {
  mode: GameModeId;
  seed: number;
  phase: PhaseId;
  setup: SetupState | null;
  activePlayer: PlayerId;
  /** Lower party order number. Breaks a first-election tie. */
  firstPlayer: PlayerId | null;
  election: ElectionRuntime;
  players: [PlayerState, PlayerState];
  districtOrder: DistrictId[];
  policy: Record<DistrictId, PolicyIdValue | null>;
  /** Always 5 cards, left → right. */
  senate: CardInstance[];
  market: CardInstance[];
  deck: CardInstance[];
  availableMonuments: CardInstance[];
  monumentDeck: CardInstance[];
  decrees: DecreeState[];
  electionsOut: CardInstance[];
  unusedParties: PartyIdValue[];
  turn: TurnState;
  /** One-shot markers for the current turn (free actions later). */
  flags: Record<string, boolean>;
  pendingDecrees: PendingDecrees | null;
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

/** Legal during the action step only when no main action is available. */
export type EndActionAction = {
  type: "endAction";
  player: PlayerId;
};

/** Politics: push out the rightmost Senator, seat a hand card on the left. */
export type InfluenceSenateAction = {
  type: "influenceSenate";
  player: PlayerId;
  instanceId: string;
};

/** Politics: reveal cards to convince a Senate majority, discard one, change a policy. */
export type ProposePolicyAction = {
  type: "proposePolicy";
  player: PlayerId;
  revealIds: string[];
  discardId: string;
  district: DistrictId;
  /** `null` is neutral. */
  policyId: PolicyIdValue | null;
};

export type DeclareVictoryAction = {
  type: "declareVictory";
  player: PlayerId;
  victory: Victory;
};

export type EndPoliticsAction = {
  type: "endPolitics";
  player: PlayerId;
};

export type TakeMarketAction = {
  type: "takeMarket";
  player: PlayerId;
  instanceId: string;
};

export type ActivateDecreeAction = {
  type: "activateDecree";
  player: PlayerId;
  decreeId: DecreeIdValue;
};

export type Action =
  | ChoosePartyAction
  | ChooseStartingHandAction
  | PlayCivilAction
  | PlayAllianceAction
  | PlayConspiracyAction
  | RecruitAction
  | ConstructAction
  | EndActionAction
  | InfluenceSenateAction
  | ProposePolicyAction
  | DeclareVictoryAction
  | EndPoliticsAction
  | TakeMarketAction
  | ActivateDecreeAction;

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
  | { type: "senateDealt"; cardIds: string[] }
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
  | { type: "politicsStarted"; player: PlayerId }
  | {
      type: "senateInfluenced";
      player: PlayerId;
      seatedCardId: string;
      removedCardId: string;
    }
  | {
      type: "policyProposed";
      player: PlayerId;
      revealedCardIds: string[];
      votes: number;
      totalVotes: number;
    }
  | {
      type: "policyChanged";
      district: DistrictId;
      policyId: PolicyIdValue | null;
      player: PlayerId;
    }
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
  | { type: "electionStarted"; player: PlayerId }
  | {
      type: "electionTallied";
      electorates: [number, number];
      electors: [number, number];
      winner: PlayerId;
      tieBreak: ElectionTieBreakId;
    }
  | { type: "electionWon"; player: PlayerId; wins: number }
  | { type: "decreeChoiceNeeded"; player: PlayerId; count: number }
  | { type: "decreeActivated"; player: PlayerId; decreeId: DecreeIdValue }
  | { type: "electionEnded" }
  | { type: "turnEnded"; nextPlayer: PlayerId };

export type ApplyResult = {
  state: GameState;
  events: GameEvent[];
};
