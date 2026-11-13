import type {
  DecreeIdValue,
  DistrictId,
  PartyIdValue,
  PolicyIdValue,
  SymbolId,
} from "../cards/schema.ts";
import type { ExpansionVictoryId, WorldPowerId } from "../cards/expansion.ts";

export type PlayerId = 0 | 1;
export const PLAYERS: readonly PlayerId[] = [0, 1];

export const GameMode = {
  Standard: "standard",
  Tourney: "tourney",
  Chaotic: "chaotic",
  Epic: "epic",
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
  /** Expansion: 2+ more monuments than the opponent. */
  Cultural: "cultural",
  /** Expansion: higher relation than the opponent with 3 of the 4 World Powers. */
  Diplomatic: "diplomatic",
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
  /** Legacy & Diplomacy chosen for this game (set up when setup finishes). */
  expansion: { foreignInfluence: boolean } | null;
};

export type TurnState = {
  /** A monument was constructed this turn (Politics step starts with a draw). */
  constructedMonument: boolean;
  /** The mandatory main action is done; only free actions or "end action step" remain. */
  mainActionDone: boolean;
  /** Kybernetik Inc.: no income step this turn (so no Market refill either). */
  skipIncome: boolean;
  /** Instance ids of alliances/monuments whose free action was used this turn. */
  freeActionsUsed: string[];
};

/** An event played for its effect, sitting in the common area. */
export type PlayedEvent = {
  card: CardInstance;
  /** The buyer. East effects are exclusive to them. `null` = Foreign Influence setup (not exclusive). */
  owner: PlayerId | null;
};

/** Legacy & Diplomacy. Event cards are `CardInstance`s whose `cardId` is an event id. */
export type ExpansionState = {
  foreignInfluence: boolean;
  eventDeck: CardInstance[];
  /** Events out of the game: removed at setup, discarded, or legacy events once played. */
  box: CardInstance[];
  commonArea: PlayedEvent[];
  relations: Record<PlayerId, Record<WorldPowerId, number>>;
  /** Inactive expansion victories flipped active by legacy events. */
  activeVictories: ExpansionVictoryId[];
  /** East "Revealed <district> cards do not occupy hand limit": face-up, usable as if in hand. */
  revealed: Record<PlayerId, CardInstance[]>;
  /**
   * Market spots at the start of the turn (instance ids, left to right). Spots are
   * preserved until the income-step collapse, and event costs are fixed for the turn.
   */
  turnMarket: string[];
  /** Event cost (non-event cards to its right) fixed at the start of the turn. */
  eventCosts: Record<string, number>;
  /**
   * During an election phase the Market is two rows: `market.slice(0, rowBreak)`
   * and `market.slice(rowBreak)`. Null outside elections.
   */
  rowBreak: number | null;
  /** Spots per row at the start of the turn, during an election (for the last-2-spots rule). */
  turnRows: [string[], string[]] | null;
};

/** A decision the active player must make before the turn moves on. */
export type PendingChoice =
  /** Currency Ballots: after drawing, discard one card from hand. */
  | { kind: "discardOne"; player: PlayerId }
  /** Urban Aristocrats: optionally swap one of your Dragonara civils with one of theirs. */
  | { kind: "swapCivils"; player: PlayerId }
  /** Intel Network: move one of the top cards (instance ids, top first) to the top. */
  | { kind: "intelNetwork"; player: PlayerId; instanceIds: string[] }
  /** People's Press: draw from the deck or take a card from your Smarbbit pile. */
  | { kind: "peoplesPress"; player: PlayerId }
  /** Space Agency: optionally move just-discarded cards to your other piles (max 1 each). */
  | { kind: "routeDiscards"; player: PlayerId; instanceIds: string[] };

/** Where the turn picks up once every pending choice is resolved. */
export type Continuation =
  | "action"
  | "afterMain"
  | "afterFree"
  | "politics"
  | "income"
  | "incomeDraw"
  | "incomeEnd";

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
  /** Choices the active player owes, resolved front to back. */
  pending: PendingChoice[];
  resume: Continuation | null;
  victory: Victory | null;
  /** Legacy & Diplomacy expansion state, or null in a base game. */
  expansion: ExpansionState | null;
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

/** Free actions from alliances and monuments (action step, once per source per turn). */
export type FreeActionAction = {
  type: "freeAction";
  player: PlayerId;
  /** Instance id of the alliance or monument granting it. */
  source: string;
} & (
  | { ability: "kybernetik" }
  | { ability: "foreignInc"; instanceId: string }
  | { ability: "centuryInc"; instanceId: string; target: { owner: PlayerId; instanceId: string } }
  | { ability: "architectureInc"; instanceIds: string[]; monumentInstanceId: string }
  | { ability: "rebelInc"; instanceIds: string[] }
  | {
      ability: "capitolInc";
      revealIds: string[];
      discardId: string;
      district: DistrictId;
      policyId: PolicyIdValue | null;
    }
  | { ability: "intelNetwork" }
  /** East event: take a card of its district from the Market into hand. */
  | { ability: "eastTake"; instanceId: string }
);

/** Planet Next / Consultative Office: move cards from hand into a face-up zone (own turn only). */
export type SetAsideAction = {
  type: "setAside";
  player: PlayerId;
  zone: "planetNextBank" | "consultativeOffice" | "eastReveal";
  instanceIds: string[];
};

/** How a bought event is played. Regular events: effect or civil. Legacy events: discard or activate. */
export type EventUse = "effect" | "civil" | "legacyDiscard" | "legacyActivate";

/** Expansion income option B: buy an event from the Market. */
export type BuyEventAction = {
  type: "buyEvent";
  player: PlayerId;
  instanceId: string;
  /** Cards paid (hand or as-if-in-hand), one per non-event card to the event's right. */
  payIds: string[];
  use: EventUse;
  /** For `legacyActivate`: which inactive victory to flip. */
  victory?: ExpansionVictoryId;
};

export type ChooseDiscardAction = { type: "chooseDiscard"; player: PlayerId; instanceId: string };
/** `null` declines the swap. */
export type ChooseSwapAction = {
  type: "chooseSwap";
  player: PlayerId;
  swap: { mine: string; theirs: string } | null;
};
export type ChooseIntelAction = { type: "chooseIntel"; player: PlayerId; instanceId: string };
/** `null` draws from the deck as usual. */
export type ChoosePressAction = { type: "choosePress"; player: PlayerId; instanceId: string | null };
export type RouteDiscardsAction = {
  type: "routeDiscards";
  player: PlayerId;
  moves: { instanceId: string; district: DistrictId }[];
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
  | ActivateDecreeAction
  | FreeActionAction
  | SetAsideAction
  | ChooseDiscardAction
  | ChooseSwapAction
  | ChooseIntelAction
  | ChoosePressAction
  | RouteDiscardsAction
  | BuyEventAction;

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
  | { type: "turnEnded"; nextPlayer: PlayerId }
  | { type: "freeActionUsed"; player: PlayerId; sourceCardId: string; ability: FreeActionAction["ability"] }
  | { type: "cardsSetAside"; player: PlayerId; zone: SetAsideAction["zone"]; cardIds: string[] }
  | { type: "civilsSwapped"; player: PlayerId; mineCardId: string; theirsCardId: string }
  | { type: "allianceReplaced"; player: PlayerId; owner: PlayerId; cardId: string; replacedCardId: string; district: DistrictId }
  | { type: "deckReordered"; player: PlayerId }
  | { type: "cardRetrieved"; player: PlayerId; cardId: string; district: DistrictId }
  | { type: "discardsRouted"; player: PlayerId; moves: { cardId: string; district: DistrictId }[] }
  | { type: "eventRevealed"; cardId: string }
  | { type: "eventBought"; player: PlayerId; cardId: string; use: EventUse; cost: number }
  | { type: "eventsRemoved"; cardIds: string[]; reason: "market" | "legacy" | "discard" }
  | { type: "relationGained"; player: PlayerId; power: WorldPowerId; relation: number }
  | { type: "victoryActivated"; player: PlayerId; victory: ExpansionVictoryId }

export type ApplyResult = {
  state: GameState;
  events: GameEvent[];
};
