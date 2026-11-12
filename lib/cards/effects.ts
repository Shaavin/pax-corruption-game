/** Registered ability ids. Handlers live in `lib/game/abilities` later. */
export const EffectId = {
  DistrictWipe: "district-wipe",
  CivilPlusOneBlockConspiracy: "civil-plus-one-block-conspiracy",
  DrawToHandLimitEndActionSkipIncome: "draw-to-hand-limit-end-action-skip-income",
  DistrictGovernor: "district-governor",
  SwapCivilAfterPlay: "swap-civil-after-play",
  TreatMarketCivilAsHand: "treat-market-civil-as-hand",
  InfluenceSenateThenDraw: "influence-senate-then-draw",
  ReplaceAllianceUnmatched: "replace-alliance-unmatched",
  CountsAsTwoAlliances: "counts-as-two-alliances",
  ConstructMonumentFourMatching: "construct-monument-four-matching",
  RecruitPartisansFree: "recruit-partisans-free",
  AlwaysHigherInfluenceDiscardCivilAfterElection:
    "always-higher-influence-discard-civil-after-election",
  WinIfOnlyAlliance: "win-if-only-alliance",
  ProposePolicyFree: "propose-policy-free",
  DrawFromOwnSupportPile: "draw-from-own-support-pile",
  ConspiracyKeepsYourCivil: "conspiracy-keeps-your-civil",
  InspectTopFiveMoveOneToTop: "inspect-top-five-move-one-to-top",
  PlusTwoHandLimitDrawAtFour: "plus-two-hand-limit-draw-at-four",
  PlanetNextBank: "planet-next-bank",
  SpaceAgencyRerouteDiscards: "space-agency-reroute-discards",
  CivilVictoryAfterThreeWins: "civil-victory-after-three-wins",
  OpponentNeedsMoreCivilToWin: "opponent-needs-more-civil-to-win",
  AllianceLimitTwoDrawOnAlliance: "alliance-limit-two-draw-on-alliance",
  SymbolPerActiveDecree: "symbol-per-active-decree",
  CurrencyBallots: "currency-ballots",
  PopulistForum: "populist-forum",
  EconomicReform: "economic-reform",
  MarketRegulation: "market-regulation",
  MartialLaw: "martial-law",
  Secularism: "secularism",
  UnitedFront: "united-front",
  ConsultativeOffice: "consultative-office",
} as const;

export type EffectId = (typeof EffectId)[keyof typeof EffectId];
export const EFFECT_IDS = Object.values(EffectId);
