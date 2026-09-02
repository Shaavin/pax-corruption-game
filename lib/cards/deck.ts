import { alliance, civil, conspiracy, election } from "./builders";
import { EffectId } from "./effects";
import { District, EffectType, TriggerWhen, type MainDeckCard } from "./schema";

const d = District.Dragonara;
const h = District.Horsard;
const s = District.Shavvinne;
const m = District.Smarbbit;

export const MAIN_DECK: MainDeckCard[] = [
  alliance(
    "dragonara-a-1",
    "Order of Knights",
    d,
    "Each of your Dragonara civil cards now gives you +1 influence. Conspiracy cannot be played in Dragonara.",
    [
      {
        type: EffectType.Static,
        id: EffectId.CivilPlusOneBlockConspiracy,
        params: { district: d },
      },
    ],
  ),
  alliance(
    "dragonara-a-2",
    "Kybernetik Inc.",
    d,
    "As a free action, you may draw to hand limit. If you do, skip income step this turn.",
    [{ type: EffectType.FreeAction, id: EffectId.DrawToHandLimitSkipIncome }],
  ),
  alliance(
    "dragonara-a-3",
    "District Governor",
    d,
    "This card silences opponent's alliances in Dragonara. The policy in Dragonara cannot be changed via policy referendum.",
    [
      {
        type: EffectType.Static,
        id: EffectId.DistrictGovernor,
        params: { district: d },
      },
    ],
  ),
  alliance(
    "dragonara-a-4",
    "District Governor",
    d,
    "This card silences opponent's alliances in Dragonara. The policy in Dragonara cannot be changed via policy referendum.",
    [
      {
        type: EffectType.Static,
        id: EffectId.DistrictGovernor,
        params: { district: d },
      },
    ],
  ),
  alliance(
    "dragonara-a-5",
    "Urban Aristocrats",
    d,
    "After playing a civil card in Dragonara, you may swap one of your civil cards with an opponent's in Dragonara.",
    [
      {
        type: EffectType.Triggered,
        id: EffectId.SwapCivilAfterPlay,
        when: TriggerWhen.PlayCivil,
        params: { district: d },
      },
    ],
  ),
  alliance(
    "dragonara-a-6",
    "State Enterprise",
    d,
    "You treat Dragonara non-alliance cards in market as if they are in your hand when you do your main or free actions.",
    [
      {
        type: EffectType.Static,
        id: EffectId.TreatMarketAsHand,
        params: { district: d },
      },
    ],
  ),
  civil("dragonara-b-1", "Technocrats", d, 9),
  civil("dragonara-b-2", "Grand Justices", d, 8),
  civil("dragonara-b-3", "Time Committee", d, 8),
  civil("dragonara-b-4", "Robot Factories", d, 7),
  civil("dragonara-b-5", "Export Bureau", d, 6),
  civil("dragonara-b-6", "Gardeners", d, 5),
  civil("dragonara-b-7", "Tinkers", d, 5),
  civil("dragonara-b-8", "Runes Tavern", d, 4),
  civil("dragonara-b-9", "Fire Breathers", d, 3),
  civil("dragonara-b-10", "Professors", d, 8),
  civil("dragonara-b-11", "Civic Council", d, 8),
  civil("dragonara-b-12", "Secret Service", d, 7),
  civil("dragonara-b-13", "Think Tanks", d, 6),
  civil("dragonara-b-14", "Programmers", d, 6),
  civil("dragonara-b-15", "Engineers", d, 5),
  civil("dragonara-b-16", "Dune Clans", d, 4),
  civil("dragonara-b-17", "Time Travelers", d, 4),
  civil("dragonara-b-18", "Winter Castles", d, 3),
  conspiracy("dragonara-c-1", "Theft of Thunder", d),
  conspiracy("dragonara-c-2", "Broken Chains", d),

  alliance(
    "horsard-a-1",
    "Order of Knights",
    h,
    "Each of your Horsard civil cards now gives you +1 influence. Conspiracy cannot be played in Horsard.",
    [
      {
        type: EffectType.Static,
        id: EffectId.CivilPlusOneBlockConspiracy,
        params: { district: h },
      },
    ],
  ),
  alliance(
    "horsard-a-2",
    "Order of Knights",
    h,
    "Each of your Horsard civil cards now gives you +1 influence. Conspiracy cannot be played in Horsard.",
    [
      {
        type: EffectType.Static,
        id: EffectId.CivilPlusOneBlockConspiracy,
        params: { district: h },
      },
    ],
  ),
  alliance(
    "horsard-a-3",
    "Foreign Inc.",
    h,
    "As a free action, you may discard a Horsard card from your hand, then draw a card.",
    [
      {
        type: EffectType.FreeAction,
        id: EffectId.DiscardDistrictThenDraw,
        params: { district: h },
      },
    ],
  ),
  alliance(
    "horsard-a-4",
    "District Governor",
    h,
    "This card silences opponent's alliances in Horsard. The policy in Horsard cannot be changed via policy referendum.",
    [
      {
        type: EffectType.Static,
        id: EffectId.DistrictGovernor,
        params: { district: h },
      },
    ],
  ),
  alliance(
    "horsard-a-5",
    "Century Club",
    h,
    "You can play an alliance card to replace your own or opponent's alliance, and its district can be unmatched.",
    [{ type: EffectType.Static, id: EffectId.ReplaceAllianceUnmatched }],
  ),
  alliance(
    "horsard-a-6",
    "Financial Bankers",
    h,
    "This card counts as 2 alliances during elections. This ability cannot be silenced.",
    [{ type: EffectType.Static, id: EffectId.CountsAsTwoAlliances }],
    2,
  ),
  civil("horsard-b-1", "Bracket Banks", h, 9),
  civil("horsard-b-2", "Resource Industry", h, 9),
  civil("horsard-b-3", "Film Industry", h, 8),
  civil("horsard-b-4", "Estate Moguls", h, 8),
  civil("horsard-b-5", "Central Bank", h, 7),
  civil("horsard-b-6", "Transportations", h, 6),
  civil("horsard-b-7", "Urban Planners", h, 5),
  civil("horsard-b-8", "Consumer Brands", h, 4),
  civil("horsard-b-9", "Veterans", h, 3),
  civil("horsard-b-10", "Magistrates", h, 9),
  civil("horsard-b-11", "Newspapers", h, 8),
  civil("horsard-b-12", "Export Giants", h, 8),
  civil("horsard-b-13", "Prestige Lawyers", h, 8),
  civil("horsard-b-14", "Regulators", h, 7),
  civil("horsard-b-15", "Workers Union", h, 6),
  civil("horsard-b-16", "Arms Dealers", h, 5),
  civil("horsard-b-17", "Influencers", h, 4),
  civil("horsard-b-18", "Masons Guild", h, 3),
  conspiracy("horsard-c-1", "Grassroot Media", h),
  conspiracy("horsard-c-2", "Idle Proliferation", h),

  alliance(
    "shavvinne-a-1",
    "Order of Knights",
    s,
    "Each of your Shavvinne civil cards now gives you +1 influence. Conspiracy cannot be played in Shavvinne.",
    [
      {
        type: EffectType.Static,
        id: EffectId.CivilPlusOneBlockConspiracy,
        params: { district: s },
      },
    ],
  ),
  alliance(
    "shavvinne-a-2",
    "Architecture Inc.",
    s,
    "As a free action, you may construct ANY available monument with ANY 4 cards of the same color.",
    [{ type: EffectType.FreeAction, id: EffectId.ConstructMonumentFourSameColor }],
  ),
  alliance(
    "shavvinne-a-3",
    "Foreign Inc.",
    s,
    "As a free action, you may discard a Shavvinne card from your hand, then draw a card.",
    [
      {
        type: EffectType.FreeAction,
        id: EffectId.DiscardDistrictThenDraw,
        params: { district: s },
      },
    ],
  ),
  alliance(
    "shavvinne-a-4",
    "Rebel Inc.",
    s,
    "As a free action, you may recruit partisans.",
    [{ type: EffectType.FreeAction, id: EffectId.RecruitPartisansFree }],
  ),
  alliance(
    "shavvinne-a-5",
    "Diet of Saints",
    s,
    "You always have higher influence in Shavvinne. Discard ALL civil cards in Shavvinne after an election.",
    [
      {
        type: EffectType.Static,
        id: EffectId.AlwaysHigherInfluenceDiscardCivilAfterElection,
        params: { district: s },
      },
    ],
  ),
  alliance(
    "shavvinne-a-6",
    "Divine Inquisitors",
    s,
    "Winning Shavvinne in elections is now determined by the amount of Shavvinne policy support instead.",
    [
      {
        type: EffectType.Static,
        id: EffectId.WinByPolicySupport,
        params: { district: s },
      },
    ],
  ),
  civil("shavvinne-b-1", "Roman Church", s, 9),
  civil("shavvinne-b-2", "TuWang Gang", s, 8),
  civil("shavvinne-b-3", "Grand Maester", s, 7),
  civil("shavvinne-b-4", "Patrons of Art", s, 5),
  civil("shavvinne-b-5", "Royal Academy", s, 5),
  civil("shavvinne-b-6", "Architects", s, 4),
  civil("shavvinne-b-7", "Hab Constructors", s, 4),
  civil("shavvinne-b-8", "Farmers", s, 3),
  civil("shavvinne-b-9", "Artisans", s, 3),
  civil("shavvinne-b-10", "Faith Whisperers", s, 9),
  civil("shavvinne-b-11", "Emirates", s, 7),
  civil("shavvinne-b-12", "Monarch Family", s, 6),
  civil("shavvinne-b-13", "Local Politicians", s, 5),
  civil("shavvinne-b-14", "Civil Advocates", s, 4),
  civil("shavvinne-b-15", "Teachers", s, 4),
  civil("shavvinne-b-16", "Mining Expats", s, 3),
  civil("shavvinne-b-17", "Buddhist Traders", s, 3),
  civil("shavvinne-b-18", "Heritage Society", s, 3),
  conspiracy("shavvinne-c-1", "Q'iat av Shah Riot", s),
  conspiracy("shavvinne-c-2", "Hub of Assassins", s),

  alliance(
    "smarbbit-a-1",
    "Foreign Inc.",
    m,
    "As a free action, you may discard a Smarbbit card from your hand, then draw a card.",
    [
      {
        type: EffectType.FreeAction,
        id: EffectId.DiscardDistrictThenDraw,
        params: { district: m },
      },
    ],
  ),
  alliance(
    "smarbbit-a-2",
    "Capitol Inc.",
    m,
    "As a free action, you may call policy referendum, ignoring the requirement for 3+ policy sponsors.",
    [{ type: EffectType.FreeAction, id: EffectId.CallReferendumIgnoreRequirement }],
  ),
  alliance(
    "smarbbit-a-3",
    "Foreign Inc.",
    m,
    "As a free action, you may discard a Smarbbit card from your hand, then draw a card.",
    [
      {
        type: EffectType.FreeAction,
        id: EffectId.DiscardDistrictThenDraw,
        params: { district: m },
      },
    ],
  ),
  alliance(
    "smarbbit-a-4",
    "People's Press",
    m,
    "When drawing from deck, you may now draw from your Smarbbit support pile instead.",
    [
      {
        type: EffectType.Static,
        id: EffectId.DrawFromOwnSupportPile,
        params: { district: m },
      },
    ],
  ),
  alliance(
    "smarbbit-a-5",
    "District Governor",
    m,
    "This card silences opponent's alliances in Smarbbit. The policy in Smarbbit cannot be changed via policy referendum.",
    [
      {
        type: EffectType.Static,
        id: EffectId.DistrictGovernor,
        params: { district: m },
      },
    ],
  ),
  alliance(
    "smarbbit-a-6",
    "Project Habitat",
    m,
    "Conspiracy no longer discards your already played civil cards in Smarbbit.",
    [
      {
        type: EffectType.Static,
        id: EffectId.ConspiracyKeepsYourCivil,
        params: { district: m },
      },
    ],
  ),
  civil("smarbbit-b-1", "Communists", m, 9),
  civil("smarbbit-b-2", "Environmentalists", m, 9),
  civil("smarbbit-b-3", "Abolitionists", m, 9),
  civil("smarbbit-b-4", "Liberalists", m, 8),
  civil("smarbbit-b-5", "Socialists", m, 8),
  civil("smarbbit-b-6", "The Capitalists", m, 7),
  civil("smarbbit-b-7", "The Middle Class", m, 7),
  civil("smarbbit-b-8", "Habitat Directors", m, 6),
  civil("smarbbit-b-9", "Radio Stations", m, 4),
  civil("smarbbit-b-10", "Preservationists", m, 9),
  civil("smarbbit-b-11", "Corporatists", m, 9),
  civil("smarbbit-b-12", "Nationalists", m, 9),
  civil("smarbbit-b-13", "Conservatives", m, 8),
  civil("smarbbit-b-14", "Fundamentalists", m, 8),
  civil("smarbbit-b-15", "The Proletariats", m, 7),
  civil("smarbbit-b-16", "Universities", m, 6),
  civil("smarbbit-b-17", "NGOs", m, 5),
  civil("smarbbit-b-18", "Anarchists", m, 3),
  conspiracy("smarbbit-c-1", "Separatists of the Ublozisky Plateau", m),
  conspiracy("smarbbit-c-2", "Power Vacuum", m),

  election(1),
  election(2),
  election(3),
  election(4),
];
