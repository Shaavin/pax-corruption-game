import type { EffectId } from "./effects.ts";

export const District = {
  Dragonara: "dragonara",
  Horsard: "horsard",
  Shavvinne: "shavvinne",
  Smarbbit: "smarbbit",
} as const;
export type DistrictId = (typeof District)[keyof typeof District];
export const DISTRICTS = Object.values(District);

export const Symbol = {
  Atom: "atom",
  Chart: "chart",
  Crown: "crown",
  Scales: "scales",
} as const;
export type SymbolId = (typeof Symbol)[keyof typeof Symbol];
export const SYMBOLS = Object.values(Symbol);

export const CardKind = {
  Civil: "civil",
  Alliance: "alliance",
  Conspiracy: "conspiracy",
  Election: "election",
  Party: "party",
  Monument: "monument",
  Policy: "policy",
  Decree: "decree",
} as const;
export type CardKindId = (typeof CardKind)[keyof typeof CardKind];

export const EffectType = {
  Static: "static",
  FreeAction: "freeAction",
  Triggered: "triggered",
} as const;
export type EffectTypeId = (typeof EffectType)[keyof typeof EffectType];

export const TriggerWhen = {
  PlayCivil: "play-civil",
  PlayAlliance: "play-alliance",
  PlayInDistrict: "play-in-district",
  AfterElection: "after-election",
  EndOfIncome: "end-of-income",
} as const;
export type TriggerWhenId = (typeof TriggerWhen)[keyof typeof TriggerWhen];

export const PolicySide = {
  A: "a",
  B: "b",
} as const;
export type PolicySideId = (typeof PolicySide)[keyof typeof PolicySide];

export const DecreeId = {
  Imperium: "decree-imperium",
  Profectus: "decree-profectus",
  Academia: "decree-academia",
  DeJures: "decree-de-jures",
} as const;
export type DecreeIdValue = (typeof DecreeId)[keyof typeof DecreeId];

export const PartyId = {
  Trinity: "party-1",
  Conservative: "party-2",
  Progressive: "party-3",
  Innovative: "party-4",
  Liberal: "party-5",
  Global: "party-6",
  Socialist: "party-7",
  Republican: "party-8",
} as const;
export type PartyIdValue = (typeof PartyId)[keyof typeof PartyId];

export const MonumentId = {
  IntelNetwork: "intel-network",
  DragonGate: "dragon-gate",
  PlanetNext: "planet-next",
  SpaceAgency: "space-agency",
  RomanBasilica: "roman-basilica",
  CivilService: "civil-service",
  ModelSociety: "model-society",
  SmartDoctrine: "smart-doctrine",
} as const;
export type MonumentIdValue = (typeof MonumentId)[keyof typeof MonumentId];

export const PolicyId = {
  DragonaraA: "dragonara-a",
  DragonaraB: "dragonara-b",
  HorsardA: "horsard-a",
  HorsardB: "horsard-b",
  ShavvinneA: "shavvinne-a",
  ShavvinneB: "shavvinne-b",
  SmarbbitA: "smarbbit-a",
  SmarbbitB: "smarbbit-b",
} as const;
export type PolicyIdValue = (typeof PolicyId)[keyof typeof PolicyId];

export type EffectParams = {
  district?: DistrictId;
};

export type Effect = {
  type: EffectTypeId;
  id: EffectId;
  when?: TriggerWhenId;
  params?: EffectParams;
};

type CardBase = {
  id: string;
  name: string;
  art: string;
};

export type CivilCard = CardBase & {
  kind: typeof CardKind.Civil;
  district: DistrictId;
  influence: number;
};

export type AllianceCard = CardBase & {
  kind: typeof CardKind.Alliance;
  district: DistrictId;
  allianceSymbols: number;
  /** Votes this card carries while seated in the Senate. */
  senateVotes: 2;
  text: string;
  effects: Effect[];
};

export type ConspiracyCard = CardBase & {
  kind: typeof CardKind.Conspiracy;
  district: DistrictId;
  text: string;
  effects: Effect[];
};

export type ElectionCard = CardBase & {
  kind: typeof CardKind.Election;
};

export type MainDeckCard =
  | CivilCard
  | AllianceCard
  | ConspiracyCard
  | ElectionCard;

export type PartyCard = CardBase & {
  id: PartyIdValue;
  kind: typeof CardKind.Party;
  order: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  symbol: SymbolId;
  startingCards: { name: string; district: DistrictId }[];
  guaranteedMonumentId: MonumentIdValue;
};

export type MonumentCard = CardBase & {
  id: MonumentIdValue;
  kind: typeof CardKind.Monument;
  district: DistrictId;
  symbols: SymbolId[];
  text: string;
  effects: Effect[];
};

export type PolicyCard = CardBase & {
  id: PolicyIdValue;
  kind: typeof CardKind.Policy;
  district: DistrictId;
  side: PolicySideId;
  symbol: SymbolId;
  text: string;
  effects: Effect[];
};

/** Double-sided. Starts inactive; an election winner activates it. */
export type DecreeCard = CardBase & {
  id: DecreeIdValue;
  kind: typeof CardKind.Decree;
  /** Name on the grey inactive side. */
  inactiveName: string;
  symbol: SymbolId;
  /** Condition printed on the active side. */
  text: string;
  /** Art for the inactive side; `art` is the active side. */
  inactiveArt: string;
};

export type CatalogCard =
  | MainDeckCard
  | PartyCard
  | MonumentCard
  | PolicyCard
  | DecreeCard;
