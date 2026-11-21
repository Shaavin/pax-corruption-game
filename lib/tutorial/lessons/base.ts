/**
 * The base-game lessons: Town Hall with Mayor Mildred, the Capital with Chancellor Crane,
 * and a final exam at the Palace with Grand Vizier Vex. Each lesson adds a few pieces of
 * the game; the table areas it doesn't use yet are dimmed.
 *
 * Card ids are catalog ids (lib/cards/deck.ts); the names are in the comments. Every rule
 * stated here follows docs/agents/game-rules.md, and `lessons.test.ts` plays each lesson
 * through the engine.
 */
import { DecreeId, District, MonumentId, PartyId, PolicyId } from "../../cards/schema.ts";
import { VictoryKind } from "../../game/types.ts";
import type { Lesson } from "../lesson.ts";

const LIBERAL = PartyId.Liberal;

/** Areas no early lesson needs. */
const EARLY_DIM = ["senate", "decrees", "supply", "elections", "center-band"];

const firstDay: Lesson = {
  id: "first-day",
  act: "townHall",
  title: "First day at Town Hall",
  summary: "The districts, civil cards, influence, and the three steps of a turn.",
  teaches: ["Districts", "Civil cards", "Influence", "Turn steps"],
  opponent: "mildred",
  intro: "Welcome to Town Hall, dear! Pull up a chair. I'll go easy on you.",
  outro: "What a lovely start! Come back tomorrow: there's more to Town Hall than shaking hands.",
  dim: EARLY_DIM,
  scenario: {
    seed: 101,
    you: {
      party: LIBERAL,
      // Roman Church 9, Film Industry 8, Radio Stations 4
      hand: ["shavvinne-b-1", "horsard-b-3", "smarbbit-b-9"],
    },
    opponent: {
      party: PartyId.Socialist,
      // Urban Planners 5, Farmers 3, Tinkers 5
      hand: ["horsard-b-7", "shavvinne-b-8", "dragonara-b-7"],
    },
    // Teachers, Masons Guild, Fire Breathers, Anarchists, Heritage Society
    senate: ["shavvinne-b-15", "horsard-b-18", "dragonara-b-9", "smarbbit-b-18", "shavvinne-b-18"],
    // Export Bureau, Central Bank, Monarch Family, Universities, Veterans
    market: ["dragonara-b-5", "horsard-b-5", "shavvinne-b-12", "smarbbit-b-16", "horsard-b-9"],
    // Engineers, Patrons of Art, NGOs, Arms Dealers
    deckTop: ["dragonara-b-15", "shavvinne-b-4", "smarbbit-b-17", "horsard-b-16"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      title: "Welcome to Pax Corruption",
      body: "Two parties compete for the Vitalic Union, a country of four districts. You lead the Liberal Party; Mayor Mildred leads the Socialists. Parts of the table you won't need today are dimmed.",
    },
    {
      kind: "explain",
      target: "lanes",
      view: "districts",
      title: "Four districts",
      body: "Shavvinne, Horsard, Dragonara, and Smarbbit, one column each. Your cards go below each district's plate, Mildred's above it.",
    },
    {
      kind: "explain",
      target: "your-hand",
      view: "districts",
      title: "Your hand",
      body: "Every card belongs to a district: its color and the tag under its name say which. Civil cards carry a number from 3 to 9, their influence.",
    },
    {
      kind: "explain",
      target: "turn",
      title: "A turn has three steps",
      body: "Action: one main action. Politics: deal with the Senate, or skip it. Income: take a card from the Market, then draw. The turn panel always says what's next.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Play a civil card",
      body: "Your main action: play Roman Church. Select it in your hand, then select the Shavvinne district.",
      expect: { type: "playCivil", card: "shavvinne-b-1" },
      hint: "For now, play Roman Church in Shavvinne.",
    },
    {
      kind: "explain",
      target: "lane:shavvinne",
      view: "districts",
      title: "Influence",
      body: "Roman Church gives you 9 influence in Shavvinne. The district's plate shows both totals, Mildred's on the left and yours on the right. When an election comes, whoever has more influence in a district wins it.",
    },
    {
      kind: "do",
      target: "turn",
      title: "Politics",
      body: "This is where you'd work the Senate. That's a lesson for later: choose Skip politics.",
      expect: { type: "endPolitics" },
      hint: "Skip politics for now.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take any one card from the Market. The Market then refills, and because you hold fewer than 5 cards (your hand limit), you also draw from the deck.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "explain",
      target: "lane:horsard",
      view: "districts",
      title: "Mildred's move",
      body: "Mildred played Urban Planners in Horsard: 5 influence there. Each district is its own contest, and you hold Film Industry, an 8 from Horsard.",
    },
    {
      kind: "free",
      until: "turnEnd",
      view: "districts",
      title: "Your turn",
      body: "Play any civil card, then finish the turn: skip politics and take a Market card. Film Industry would put you ahead in Horsard.",
      hint: "Select Film Industry, then Horsard. Skip politics, then take any Market card.",
      solution: [{ type: "playCivil", card: "horsard-b-3" }, { type: "endPolitics" }, { type: "takeMarket" }],
    },
  ],
  script: [
    { type: "playCivil", card: "horsard-b-7", say: "Horsard could use some planning. Urban Planners, dear!" },
    { type: "endPolitics" },
    { type: "takeMarket", say: "Ooh, I'll take this pretty one." },
  ],
};

const scandal: Lesson = {
  id: "scandal",
  act: "townHall",
  title: "Scandal in Horsard",
  summary: "Conspiracies wipe a district, and support piles turn the wreckage into influence.",
  teaches: ["Conspiracies", "Support piles", "Popularity Victory"],
  opponent: "mildred",
  intro: "My bankers have Horsard sewn up, dear. Nothing short of a scandal could shift them.",
  outro: "A scandal! At my Town Hall! Well. I suppose that's politics.",
  dim: EARLY_DIM,
  scenario: {
    seed: 102,
    you: {
      party: LIBERAL,
      // Grassroot Media (conspiracy), Influencers 4, Dune Clans 4
      hand: ["horsard-c-1", "horsard-b-17", "dragonara-b-16"],
      // Veterans 3 in Horsard, Roman Church 9 in Shavvinne
      tableau: { horsard: ["horsard-b-9"], shavvinne: ["shavvinne-b-1"] },
    },
    opponent: {
      party: PartyId.Socialist,
      // Farmers 3, NGOs 5, Tinkers 5
      hand: ["shavvinne-b-8", "smarbbit-b-17", "dragonara-b-7"],
      // Bracket Banks 9, Arms Dealers 5 in Horsard; Gardeners 5 in Dragonara
      tableau: { horsard: ["horsard-b-1", "horsard-b-16"], dragonara: ["dragonara-b-6"] },
    },
    senate: ["shavvinne-b-15", "horsard-b-18", "dragonara-b-9", "smarbbit-b-18", "shavvinne-b-18"],
    // Export Bureau, Central Bank, Monarch Family, Universities, Masons… (Transportations)
    market: ["dragonara-b-5", "horsard-b-5", "shavvinne-b-12", "smarbbit-b-16", "horsard-b-6"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "lane:horsard",
      view: "districts",
      title: "Mildred's stronghold",
      body: "Mildred leads Horsard 14 to 3. Cards in play stay put… unless someone plays a conspiracy.",
    },
    {
      kind: "explain",
      target: "your-hand",
      view: "districts",
      title: "Conspiracies",
      body: "Grassroot Media is a conspiracy (the flame). Playing one wipes its district: every civil and alliance card there, both players', goes to its owner's support pile. Then the conspiracy goes to your support pile too.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Wipe Horsard",
      body: "Select Grassroot Media, then Horsard.",
      expect: { type: "playConspiracy", card: "horsard-c-1" },
      hint: "Play Grassroot Media into Horsard.",
    },
    {
      kind: "explain",
      target: "lane:horsard",
      view: "districts",
      title: "Support piles",
      body: "The wiped cards now sit in the support piles under Horsard. Every card in your support pile is worth 1 influence in its district: Mildred has 2, and so do you (Veterans and Grassroot Media). From 14–3 to 2–2, and a tie wins a district for nobody.",
    },
    {
      kind: "explain",
      target: "lane:horsard",
      view: "districts",
      title: "Popularity Victory",
      body: "Support piles also race toward Popularity Victory: lead a district's support piles by 9 cards and you may declare it. Select a district's support piles any time to see every card in both.",
    },
    {
      kind: "do",
      target: "turn",
      title: "Skip politics",
      body: "Still not Senate time. Skip politics.",
      expect: { type: "endPolitics" },
      hint: "Skip politics for now.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take any card from the Market.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "free",
      until: "turnEnd",
      view: "districts",
      title: "Take Horsard",
      body: "Horsard is tied 2–2. Influencers is a Horsard 4: play it to lead, then finish your turn however you like.",
      hint: "Select Influencers, then Horsard. Skip politics, then take a Market card.",
      solution: [{ type: "playCivil", card: "horsard-b-17" }, { type: "endPolitics" }, { type: "takeMarket" }],
    },
  ],
  script: [
    { type: "playCivil", card: "dragonara-b-7", say: "My poor bankers! Well. Tinkers to Dragonara, then." },
    { type: "endPolitics" },
    { type: "takeMarket" },
  ],
};

const friends: Lesson = {
  id: "friends",
  act: "townHall",
  title: "Friends in high places",
  summary: "Alliances bring abilities instead of influence, and handshakes win the Council of Lords.",
  teaches: ["Alliances", "Council of Lords"],
  opponent: "mildred",
  intro: "It's not what you know in this town, dear. It's who.",
  outro: "Knights in two districts! You've been reading the society pages.",
  dim: EARLY_DIM,
  scenario: {
    seed: 103,
    you: {
      party: LIBERAL,
      // Order of Knights (Dragonara), Order of Knights (Shavvinne), Consumer Brands 4
      hand: ["dragonara-a-1", "shavvinne-a-1", "horsard-b-8"],
      // Programmers 6, Engineers 5 in Dragonara; Monarch Family 6 in Shavvinne
      tableau: { dragonara: ["dragonara-b-14", "dragonara-b-15"], shavvinne: ["shavvinne-b-12"] },
    },
    opponent: {
      party: PartyId.Socialist,
      // Order of Knights (Horsard), Urban Planners 5, Teachers 4
      hand: ["horsard-a-2", "horsard-b-7", "shavvinne-b-15"],
      // Technocrats 9, Fire Breathers 3 in Dragonara; Farmers 3 in Shavvinne
      tableau: { dragonara: ["dragonara-b-1", "dragonara-b-9"], shavvinne: ["shavvinne-b-8"] },
    },
    // Heritage Society, Masons Guild, Winter Castles, Anarchists, Mining Expats
    senate: ["shavvinne-b-18", "horsard-b-18", "dragonara-b-18", "smarbbit-b-18", "shavvinne-b-16"],
    // Export Bureau, Central Bank, Local Politicians, Universities, Transportations
    market: ["dragonara-b-5", "horsard-b-5", "shavvinne-b-13", "smarbbit-b-16", "horsard-b-6"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "your-hand",
      view: "districts",
      title: "Alliances",
      body: "Alliance cards carry a handshake and an ability instead of a number. They give no influence themselves, and each player may have only one alliance per district.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Play an alliance",
      body: "The Dragonara Order of Knights reads: \"Each of your Dragonara civil cards now gives you +1 influence. Conspiracy cannot be played in Dragonara.\" Play it into Dragonara.",
      expect: { type: "playAlliance", card: "dragonara-a-1" },
      hint: "Play the Dragonara Order of Knights into Dragonara.",
    },
    {
      kind: "explain",
      target: "lane:dragonara",
      view: "districts",
      title: "Knights at work",
      body: "Your two Dragonara civils now give 7 and 6: 13 influence to Mildred's 12. And no conspiracy can wipe Dragonara while the Knights stand.",
    },
    {
      kind: "explain",
      target: "partisans",
      title: "The Council of Lords",
      body: "Elections score five electorates: the four districts and the Council of Lords. Whoever has more handshakes across their alliances in play wins the Council. Lords: you 1, Mildred 0.",
    },
    {
      kind: "do",
      target: "turn",
      title: "Skip politics",
      body: "Skip politics.",
      expect: { type: "endPolitics" },
      hint: "Skip politics for now.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take any card from the Market.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "explain",
      target: "partisans",
      title: "A tie for the Lords",
      body: "Mildred played her own Order of Knights in Horsard, so the Lords are tied 1–1, and a tie wins the Council for nobody.",
    },
    {
      kind: "free",
      until: "turnEnd",
      view: "districts",
      title: "Your turn",
      body: "Your other Order of Knights belongs to Shavvinne. Play it to lead the Lords again (and strengthen your Shavvinne civil), then finish your turn.",
      hint: "Select the Shavvinne Order of Knights, then Shavvinne. Skip politics, then take a Market card.",
      solution: [{ type: "playAlliance", card: "shavvinne-a-1" }, { type: "endPolitics" }, { type: "takeMarket" }],
    },
  ],
  script: [
    { type: "playAlliance", card: "horsard-a-2", say: "Two can play at that game, dear. Knights for Horsard!" },
    { type: "endPolitics" },
    { type: "takeMarket" },
  ],
};

const rally: Lesson = {
  id: "rally",
  act: "townHall",
  title: "Rally the base",
  summary: "Recruit partisans, then declare your first victory.",
  teaches: ["Recruit", "Partisans", "Military Victory", "Declaring"],
  opponent: "mildred",
  intro: "Two rallies already this week? My, my. Don't let it go to your head.",
  outro: "Well I never! You'll go far, dear. Off to the Capital with you: Chancellor Crane will want a word.",
  dim: ["senate", "decrees", "supply", "elections"],
  scenario: {
    seed: 104,
    you: {
      party: LIBERAL,
      partisans: 2,
      // Communists 9, NGOs 5, Anarchists 3, Consumer Brands 4
      hand: ["smarbbit-b-1", "smarbbit-b-17", "smarbbit-b-18", "horsard-b-8"],
      // Film Industry 8 in Horsard
      tableau: { horsard: ["horsard-b-3"] },
      // Radio Stations in your Smarbbit pile
      support: { smarbbit: ["smarbbit-b-9"] },
    },
    opponent: {
      party: PartyId.Socialist,
      // Urban Planners 5, Farmers 3, Tinkers 5
      hand: ["horsard-b-7", "shavvinne-b-8", "dragonara-b-7"],
      // Gardeners 5 in Dragonara, NGOs… (Universities 6) in Smarbbit
      tableau: { dragonara: ["dragonara-b-6"], smarbbit: ["smarbbit-b-16"] },
    },
    senate: ["shavvinne-b-15", "horsard-b-18", "dragonara-b-9", "shavvinne-b-16", "shavvinne-b-18"],
    market: ["dragonara-b-5", "horsard-b-5", "shavvinne-b-12", "smarbbit-b-15", "horsard-b-6"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "center-band",
      view: "districts",
      title: "Partisans",
      body: "Every recruit adds a partisan. The tug-of-war on this band shows the gap: lead by 3 and you can declare Military Victory. You lead 2–0.",
    },
    {
      kind: "explain",
      target: "action-cards",
      view: "districts",
      title: "Recruit partisans",
      body: "A main action: discard 3 cards of one district from your hand (they go to your support pile) and gain a partisan. You can only recruit in a district where your support pile already holds a card, and your Smarbbit pile has one.",
    },
    {
      kind: "do",
      target: "action-cards",
      view: "districts",
      title: "Recruit",
      body: "Choose Recruit partisans, select your three Smarbbit cards, then confirm.",
      expect: { type: "recruit", district: District.Smarbbit },
      hint: "Recruit with your three Smarbbit cards.",
    },
    {
      kind: "explain",
      target: "center-band",
      view: "districts",
      title: "3–0",
      body: "Victories (all but Civil) are declared in your own Politics step, and declaring is your one politics option that turn. Military Victory is ready.",
    },
    {
      kind: "do",
      target: "action-cards",
      view: "districts",
      title: "Declare it",
      body: "Choose Declare Military Victory.",
      expect: { type: "declareVictory", victory: VictoryKind.Military },
      hint: "Declare Military Victory.",
    },
  ],
  script: [],
};

const senate: Lesson = {
  id: "senate",
  act: "capital",
  title: "The Senate",
  summary: "Senators carry votes; seating one sends another to your support pile.",
  teaches: ["The Senate", "Votes", "Influence Senate"],
  opponent: "crane",
  intro: "So you're the one who embarrassed Mildred. The Capital keeps stricter hours. Shall we?",
  outro: "You learn quickly. Good. The Senate is only the furniture; next, the law.",
  dim: ["decrees", "supply", "elections"],
  scenario: {
    seed: 105,
    you: {
      party: LIBERAL,
      // Professors 8, Fire Breathers 3, Universities 6
      hand: ["dragonara-b-10", "dragonara-b-9", "smarbbit-b-16"],
      // Central Bank 7 in Horsard
      tableau: { horsard: ["horsard-b-5"] },
    },
    opponent: {
      party: PartyId.Conservative,
      // Newspapers 8, Buddhist Traders 3, Conservatives 8
      hand: ["horsard-b-11", "shavvinne-b-17", "smarbbit-b-13"],
      // Regulators 7 in Horsard
      tableau: { horsard: ["horsard-b-14"] },
    },
    // Teachers, Capitol Inc. (alliance), Masons Guild, Theft of Thunder (conspiracy), Estate Moguls
    senate: ["shavvinne-b-15", "smarbbit-a-2", "horsard-b-18", "dragonara-c-1", "horsard-b-4"],
    market: ["dragonara-b-5", "shavvinne-b-12", "smarbbit-b-17", "horsard-b-6", "shavvinne-b-4"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "senate",
      view: "table",
      title: "The Senate",
      body: "Five Senators, always five. Each carries votes: civil and conspiracy cards 1, alliances 2. This Senate holds 6.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Main action first",
      body: "Play Professors in Dragonara.",
      expect: { type: "playCivil", card: "dragonara-b-10" },
      hint: "Play Professors in Dragonara.",
    },
    {
      kind: "explain",
      target: "turn",
      title: "Politics",
      body: "Now pick one of three: Influence Senate, Propose Policy, or Declare Victory. (Or skip.)",
    },
    {
      kind: "do",
      target: "senate",
      view: "table",
      title: "Influence Senate",
      body: "Select a card in your hand and choose Seat in the Senate. It takes the leftmost seat, everyone shifts right, and the rightmost Senator (Estate Moguls) goes to your support pile. Fire Breathers is a good card to spare.",
      expect: { type: "influenceSenate" },
      hint: "Seat any card from your hand in the Senate.",
    },
    {
      kind: "explain",
      target: "lane:horsard",
      view: "districts",
      title: "A Senator for your pile",
      body: "Estate Moguls joined your Horsard support pile: +1 influence there. Horsard was tied 7–7; now you lead 8–7.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take any card from the Market.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "explain",
      target: "senate",
      view: "table",
      title: "Crane answers",
      body: "Crane played Newspapers in Horsard and seated a Senator of his own: Theft of Thunder, the rightmost, went to his support pile.",
    },
    {
      kind: "free",
      until: "turnEnd",
      title: "Your turn",
      body: "Play a card, then use Politics: seat another Senator, or skip. Then take a Market card.",
      hint: "Play any civil card, seat a card in the Senate, then take a Market card.",
      solution: [{ type: "playCivil", card: "smarbbit-b-16" }, { type: "influenceSenate" }, { type: "takeMarket" }],
    },
  ],
  script: [
    { type: "playCivil", card: "horsard-b-11", say: "A free press. In Horsard, naturally." },
    { type: "influenceSenate", card: "shavvinne-b-17", say: "Allow me to return the favor." },
    { type: "takeMarket" },
  ],
};

const law: Lesson = {
  id: "law",
  act: "capital",
  title: "Changing the law",
  summary: "Convince a majority of the Senate and change a district's policy.",
  teaches: ["Propose Policy", "Policies", "Symbols"],
  opponent: "crane",
  intro: "Laws are written by those who can count. Can you?",
  outro: "Secularism. Bold. I'll be drafting a repeal, of course.",
  dim: ["decrees", "supply", "elections"],
  scenario: {
    seed: 106,
    you: {
      party: LIBERAL,
      // Capitol Inc., TuWang Gang 8, Teachers 4, Urban Planners 5
      hand: ["smarbbit-a-2", "shavvinne-b-2", "shavvinne-b-15", "horsard-b-7"],
      // Patrons of Art 5, Architects 4 in Shavvinne
      tableau: { shavvinne: ["shavvinne-b-4", "shavvinne-b-6"] },
    },
    opponent: {
      party: PartyId.Conservative,
      // Conservatives 8, Influencers 4, Fire Breathers 3
      hand: ["smarbbit-b-13", "horsard-b-17", "dragonara-b-9"],
      // Grand Maester 7, Monarch Family 6 in Shavvinne
      tableau: { shavvinne: ["shavvinne-b-3", "shavvinne-b-12"] },
    },
    // The rulebook's example: People's Press, Local Politicians 5, Civil Advocates 4,
    // Financial Bankers, Broken Chains = 7 votes.
    senate: ["smarbbit-a-4", "shavvinne-b-13", "shavvinne-b-14", "horsard-a-6", "dragonara-c-2"],
    market: ["dragonara-b-5", "horsard-b-5", "smarbbit-b-17", "horsard-b-6", "dragonara-b-14"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "senate",
      view: "table",
      title: "Propose Policy",
      body: "Reveal cards from your hand to convince Senators. A civil Senator is convinced by a higher civil card of its district; an alliance Senator by an alliance of its district; a conspiracy never. Convince more than half the votes (here 4 of 7) and you may change a policy.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Main action first",
      body: "Play Teachers in Shavvinne.",
      expect: { type: "playCivil", card: "shavvinne-b-15" },
      hint: "Play Teachers in Shavvinne.",
    },
    {
      kind: "explain",
      target: "senate",
      view: "table",
      title: "Count the votes",
      body: "Capitol Inc., a Smarbbit alliance, convinces People's Press: 2 votes. TuWang Gang, a Shavvinne 8, beats both Local Politicians 5 and Civil Advocates 4: 2 more. That's 4.",
    },
    {
      kind: "do",
      target: "action-cards",
      title: "Propose",
      body: "Choose Propose policy and reveal Capitol Inc. and TuWang Gang. Then Choose a policy: Shavvinne, Secularism. Last, discard one of the two revealed cards; the other goes back to your hand.",
      expect: { type: "proposePolicy", district: District.Shavvinne, policy: PolicyId.ShavvinneB },
      hint: "Propose Secularism in Shavvinne, revealing Capitol Inc. and TuWang Gang.",
    },
    {
      kind: "explain",
      target: "lane:shavvinne",
      view: "districts",
      title: "Secularism",
      body: "\"Civil cards in Shavvinne of 5 or lower each count influence twice.\" Your 5, 4, and 4 now count double, and Crane's 7 and 6 don't. Policies apply to both players, and only change one notch at a time: neutral to a side, or a side back to neutral.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take any card from the Market.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "free",
      until: "turnEnd",
      title: "Your turn",
      body: "Play on. Try Propose policy again to see which Senators each card would convince; Cancel backs out.",
      hint: "Play Urban Planners in Horsard, skip politics, then take a Market card.",
      solution: [{ type: "playCivil", card: "horsard-b-7" }, { type: "endPolitics" }, { type: "takeMarket" }],
    },
  ],
  script: [
    { type: "playCivil", card: "smarbbit-b-13", say: "The law giveth. I'll be back for it." },
    { type: "endPolitics" },
    { type: "takeMarket" },
  ],
};

const monuments: Lesson = {
  id: "monuments",
  act: "capital",
  title: "Monuments",
  summary: "Spend five cards of a district on a permanent ability and symbol.",
  teaches: ["Monuments", "Symbols"],
  opponent: "crane",
  intro: "Anyone can win a vote. Monuments outlast the people who build them.",
  outro: "A monument. How very… permanent. Don't let the pigeons near it.",
  dim: ["decrees", "elections"],
  scenario: {
    seed: 107,
    you: {
      party: LIBERAL,
      // Liberalists 8, Socialists 8, The Capitalists 7, Habitat Directors 6, Power Vacuum
      hand: ["smarbbit-b-4", "smarbbit-b-5", "smarbbit-b-6", "smarbbit-b-8", "smarbbit-c-2"],
      // Film Industry 8 in Horsard
      tableau: { horsard: ["horsard-b-3"] },
    },
    opponent: {
      party: PartyId.Conservative,
      // Conservatives 8, Influencers 4, Fire Breathers 3
      hand: ["smarbbit-b-13", "horsard-b-17", "dragonara-b-9"],
      tableau: { horsard: ["horsard-b-14"] },
    },
    senate: ["shavvinne-b-15", "horsard-b-18", "dragonara-b-18", "smarbbit-b-18", "shavvinne-b-16"],
    market: ["dragonara-b-5", "horsard-b-5", "shavvinne-b-12", "smarbbit-b-17", "horsard-b-6"],
    monuments: [MonumentId.ModelSociety, MonumentId.DragonGate, MonumentId.CivilService, MonumentId.SpaceAgency],
    // Magistrates 9: the draw at the start of your Politics step.
    deckTop: ["horsard-b-10"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "supply",
      view: "table",
      title: "Monuments",
      body: "Permanent buildings with an ability and a political symbol. Build one as your main action by discarding 5 cards of its district from your hand. Four are available.",
    },
    {
      kind: "do",
      target: "action-cards",
      title: "Build Model Society",
      body: "Choose Build monument, select your five Smarbbit cards, then select Model Society.",
      expect: { type: "construct", monument: MonumentId.ModelSociety },
      hint: "Build Model Society with your five Smarbbit cards.",
    },
    {
      kind: "explain",
      target: "your-party",
      title: "Yours for good",
      body: "Model Society sits beside your party now: \"You can now have 2 alliances in a district. Draw a card when you play an alliance.\" Its symbol counts toward Ideological Victory. Building also drew you a card as Politics began, and the five cards you spent went to your Smarbbit support pile.",
    },
    {
      kind: "do",
      target: "turn",
      title: "Skip politics",
      body: "Skip politics this time.",
      expect: { type: "endPolitics" },
      hint: "Skip politics for now.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take any card from the Market.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "free",
      until: "turnEnd",
      title: "Your turn",
      body: "Play on as you like.",
      hint: "Play Magistrates in Horsard, skip politics, then take a Market card.",
      solution: [{ type: "playCivil", card: "horsard-b-10" }, { type: "endPolitics" }, { type: "takeMarket" }],
    },
  ],
  script: [
    { type: "playCivil", card: "smarbbit-b-13" },
    { type: "endPolitics" },
    { type: "takeMarket", say: "I prefer my investments liquid." },
  ],
};

const electionNight: Lesson = {
  id: "election",
  act: "capital",
  title: "Election night",
  summary: "How a General Election starts, how the votes are counted, and what the winner gets.",
  teaches: ["Elections", "Electorates", "Decrees"],
  opponent: "crane",
  intro: "Election night. I've already written my victory speech. Would you like to hear it?",
  outro: "Congratulations on your mandate. Do enjoy it while it lasts.",
  dim: ["supply"],
  scenario: {
    seed: 108,
    election: { out: 1, thisPhase: 1 },
    you: {
      party: LIBERAL,
      // NGOs 5, Dune Clans 4, Influencers 4
      hand: ["smarbbit-b-17", "dragonara-b-16", "horsard-b-17"],
      tableau: {
        // TuWang Gang 8, Teachers 4
        shavvinne: ["shavvinne-b-2", "shavvinne-b-15"],
        // Central Bank 7
        horsard: ["horsard-b-5"],
        // Technocrats 9, Gardeners 5
        dragonara: ["dragonara-b-1", "dragonara-b-6"],
        // Universities 6
        smarbbit: ["smarbbit-b-16"],
      },
    },
    opponent: {
      party: PartyId.Conservative,
      // Fire Breathers 3, Masons Guild 3
      hand: ["dragonara-b-9", "horsard-b-18"],
      tableau: {
        // Mining Expats 3, Monarch Family 6
        shavvinne: ["shavvinne-b-16", "shavvinne-b-12"],
        // Order of Knights (alliance), Bracket Banks 9, Regulators 7
        horsard: ["horsard-a-1", "horsard-b-1", "horsard-b-14"],
        // Secret Service 7
        dragonara: ["dragonara-b-12"],
        // Conservatives 8
        smarbbit: ["smarbbit-b-13"],
      },
    },
    senate: ["shavvinne-b-18", "horsard-b-16", "dragonara-b-18", "smarbbit-b-18", "shavvinne-b-17"],
    // One card left: Export Giants
    market: ["horsard-b-12"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "elections",
      view: "table",
      title: "An election is under way",
      body: "Four General Elections hide in the deck. When one turns up, an election starts: the Market grows to 8 and stops refilling. When a turn ends with the Market empty, the votes are counted. One card left.",
    },
    {
      kind: "explain",
      target: "partisans",
      title: "Counting the votes",
      body: "Each district goes to the player with more influence there; the Council of Lords to more handshakes. Whoever wins more of those 5 electorates wins. Now: you 2 (Shavvinne, Dragonara), Crane 3 (Horsard, Smarbbit, and the Lords).",
    },
    {
      kind: "do",
      target: "lane:smarbbit",
      view: "districts",
      title: "Swing Smarbbit",
      body: "NGOs is a Smarbbit 5. With Universities that's 11 to Crane's 8. Play it.",
      expect: { type: "playCivil", card: "smarbbit-b-17" },
      hint: "Play NGOs in Smarbbit.",
    },
    {
      kind: "do",
      target: "turn",
      title: "Skip politics",
      body: "Skip politics.",
      expect: { type: "endPolitics" },
      hint: "Skip politics this time.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Take the last card",
      body: "Take Export Giants. Your turn ends with the Market empty, and the votes are counted.",
      expect: { type: "takeMarket" },
      hint: "Take the last Market card.",
    },
    {
      kind: "do",
      title: "You won!",
      body: "3 electorates to 2. The winner activates one inactive decree for each General Election in this election. Pick one: a decree whose symbol matches your party's (Liberal: the chart) also helps toward Ideological Victory.",
      expect: { type: "activateDecree" },
      hint: "Pick any decree to activate.",
    },
    {
      kind: "explain",
      now: true,
      target: "decrees",
      view: "table",
      title: "Decrees",
      body: "An active decree is a goal for both players. Meet two active decrees at once and you may declare Political Victory. And the game's last General Election starts the final election, whose winner takes Civil Victory.",
    },
  ],
  script: [],
};

const seize: Lesson = {
  id: "political",
  act: "capital",
  title: "Seize the moment",
  summary: "Meet two active decrees at once for Political Victory, and meet the other ways to win.",
  teaches: ["Political Victory", "Ideological Victory", "Civil Victory"],
  opponent: "crane",
  intro: "Two decrees in force, and I meet neither. Neither do you. Yet.",
  outro: "Precise. Patient. I'd have done the same. The Grand Vizier will hear of this, I'm afraid.",
  dim: ["supply"],
  scenario: {
    seed: 109,
    activeDecrees: [DecreeId.Imperium, DecreeId.Profectus],
    you: {
      party: LIBERAL,
      partisans: 1,
      // Film Industry 8, Urban Planners 5, Influencers 4, Radio Stations 4
      hand: ["horsard-b-3", "horsard-b-7", "horsard-b-17", "smarbbit-b-9"],
      tableau: { shavvinne: ["shavvinne-b-2"], dragonara: ["dragonara-b-14"] },
      // 3 support: Veterans (Horsard), Mining Expats and Buddhist Traders (Shavvinne)
      support: { horsard: ["horsard-b-9"], shavvinne: ["shavvinne-b-16", "shavvinne-b-17"] },
    },
    opponent: {
      party: PartyId.Conservative,
      partisans: 1,
      hand: ["smarbbit-b-13", "dragonara-b-16", "shavvinne-b-15"],
      tableau: { horsard: ["horsard-b-1"], smarbbit: ["smarbbit-b-6"] },
      // 2 support: Fire Breathers (Dragonara), Anarchists (Smarbbit)
      support: { dragonara: ["dragonara-b-9"], smarbbit: ["smarbbit-b-18"] },
    },
    senate: ["shavvinne-b-18", "horsard-b-16", "dragonara-b-18", "smarbbit-b-16", "shavvinne-b-12"],
    market: ["dragonara-b-5", "horsard-b-5", "shavvinne-b-13", "smarbbit-b-17", "horsard-b-6"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "decrees",
      view: "table",
      title: "Two active decrees",
      body: "Imperium: have more partisans than your opponent. Profectus: have 4 or more total support than your opponent. Meet both at once and you may declare Political Victory.",
    },
    {
      kind: "explain",
      target: "center-band",
      view: "districts",
      title: "Where you stand",
      body: "Partisans are tied 1–1, so no Imperium. Total support (every card in your support piles): you 3, Crane 2, so Profectus needs 3 more.",
    },
    {
      kind: "do",
      target: "action-cards",
      view: "districts",
      title: "One move for both",
      body: "Recruiting adds a partisan, and the 3 cards you discard go to your support pile. Recruit with your three Horsard cards (your Horsard pile already holds Veterans).",
      expect: { type: "recruit", district: District.Horsard },
      hint: "Recruit with your three Horsard cards.",
    },
    {
      kind: "explain",
      target: "center-band",
      view: "districts",
      title: "The other ways to win",
      body: "Ideological: political symbols come from parties, monuments, active policies, and active decrees. Win with a symbol that has at least 4 copies and more than any other symbol, if you hold more private copies of it (party and monuments) than your opponent. Civil: win the final election.",
    },
    {
      kind: "do",
      target: "action-cards",
      title: "Declare",
      body: "Partisans 2–1 and support 6–2: both decrees are met. Declare Political Victory before Crane can undo either.",
      expect: { type: "declareVictory", victory: VictoryKind.Political },
      hint: "Declare Political Victory.",
    },
  ],
  script: [],
};

const exam: Lesson = {
  id: "exam",
  act: "palace",
  title: "The Grand Vizier",
  summary: "Final exam: Vex wins next turn unless you win first. No hand-holding.",
  teaches: ["Final exam"],
  opponent: "vex",
  intro: "Ah, the prodigy. I hope you said goodbye to Mildred. I'll be declaring victory on my next turn.",
  outro: "…Impressive. The Union is yours. For now.",
  lose: "Predictable. Shall we go again? I do so enjoy winning.",
  scenario: {
    seed: 110,
    you: {
      party: LIBERAL,
      // Q'iat av Shah Riot (Shavvinne conspiracy), Transportations 6, The Proletariats 7
      hand: ["shavvinne-c-1", "horsard-b-6", "smarbbit-b-15"],
      // Teachers 4, Mining Expats 3 in Shavvinne; Central Bank 7 in Horsard
      tableau: { shavvinne: ["shavvinne-b-15", "shavvinne-b-16"], horsard: ["horsard-b-5"] },
      // 7 cards in your Shavvinne support pile
      support: {
        shavvinne: ["shavvinne-b-5", "shavvinne-b-7", "shavvinne-b-9", "shavvinne-b-10", "shavvinne-b-11", "shavvinne-b-13", "shavvinne-b-14"],
      },
    },
    opponent: {
      party: PartyId.Trinity,
      partisans: 2,
      // Grand Justices 8, Time Committee 8, Robot Factories 7 (all Dragonara)
      hand: ["dragonara-b-2", "dragonara-b-3", "dragonara-b-4"],
      // Roman Church 9 in Shavvinne; Bracket Banks 9 in Horsard
      tableau: { shavvinne: ["shavvinne-b-1"], horsard: ["horsard-b-1"] },
      // Winter Castles in his Dragonara pile: he can recruit there
      support: { dragonara: ["dragonara-b-18"] },
    },
    senate: ["shavvinne-b-18", "horsard-b-16", "dragonara-b-16", "smarbbit-b-18", "shavvinne-b-12"],
    market: ["dragonara-b-5", "horsard-b-12", "shavvinne-b-4", "smarbbit-b-17", "horsard-b-7"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      title: "Final exam",
      body: "Vex leads partisans 2–0 and holds three Dragonara cards, with a card already in his Dragonara support pile. On his turn he'll recruit and declare Military Victory. Win before he does: this turn.",
    },
    {
      kind: "free",
      until: "victory",
      title: "Win this turn",
      body: "Find a victory you can declare in this turn's Politics step. Everything you've learned counts. Stuck? Press Hint.",
      hint: "Look at your Shavvinne support: 7 cards to Vex's 0. When a district is wiped, where do your own cards go? Popularity Victory needs a lead of 9 in one district.",
      solution: [{ type: "playConspiracy", card: "shavvinne-c-1" }, { type: "declareVictory", victory: VictoryKind.Popularity }],
    },
  ],
  script: [
    { type: "recruit", district: District.Dragonara, say: "As foreseen. Three Dragonara cards, one more partisan." },
    { type: "declareVictory", victory: VictoryKind.Military, say: "The Union bows to the Palace." },
  ],
};

export const BASE_LESSONS: Lesson[] = [
  firstDay,
  scandal,
  friends,
  rally,
  senate,
  law,
  monuments,
  electionNight,
  seize,
  exam,
];
