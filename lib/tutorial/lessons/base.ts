/**
 * The base-game lessons, a climb up the ladder (Joe, 2026-11-22): Town Hall with Mayor Mildred
 * (the ground floor, no politics yet), the Capital with her old friend Chancellor Crane (the
 * over-the-table game), and the Old Palace with retired Grand Vizier Vex (the game played in the
 * shadows, then a whole game leading your own party).
 *
 * Card ids are catalog ids (lib/cards/deck.ts); the names are in the comments. Every rule
 * stated here follows docs/agents/game-rules.md, and `lessons.test.ts` plays each lesson
 * through the engine and checks the numbers the coach quotes.
 */
import { DecreeId, District, MonumentId, PartyId, PolicyId } from "../../cards/schema.ts";
import type { Lesson } from "../lesson.ts";

const LIBERAL = PartyId.Liberal;

/** Town Hall teaches no politics: these areas are off the screen (and the Politics step passes by itself). */
const TOWN_HALL_HIDE = ["senate", "decrees", "supply", "center-band", "action-cards"];

// --- Town Hall ----------------------------------------------------------------------------------

const firstDay: Lesson = {
  id: "first-day",
  act: "townHall",
  title: "First Day in Town",
  summary: "Civil cards and alliances, the five electorates, and how income fills your hand.",
  teaches: ["Civil cards", "Alliances", "Electorates", "Hand limit", "Income"],
  opponent: "mildred",
  intro:
    "So you're the bright young thing everyone's whispering about. Sit, dear. I've run this Town Hall for forty years, and I'm tired. Show me what you've got.",
  outro: "A natural! Elections are won one district at a time, dear. Come back tomorrow: there's trouble brewing in Horsard.",
  hide: TOWN_HALL_HIDE,
  skipPolitics: true,
  scenario: {
    seed: 101,
    you: {
      party: LIBERAL,
      // Roman Church 9, Film Industry 8, Order of Knights (Dragonara alliance), Radio Stations 4, Consumer Brands 4
      hand: ["shavvinne-b-1", "horsard-b-3", "dragonara-a-1", "smarbbit-b-9", "horsard-b-8"],
      // Programmers 6, Engineers 5 in Dragonara
      tableau: { dragonara: ["dragonara-b-14", "dragonara-b-15"] },
    },
    opponent: {
      party: PartyId.Socialist,
      // Order of Knights (Horsard alliance), Urban Planners 5, Teachers 4, Tinkers 5
      hand: ["horsard-a-2", "horsard-b-7", "shavvinne-b-15", "dragonara-b-7"],
      // Technocrats 9, Fire Breathers 3 in Dragonara
      tableau: { dragonara: ["dragonara-b-1", "dragonara-b-9"] },
    },
    senate: ["shavvinne-b-18", "horsard-b-18", "dragonara-b-18", "smarbbit-b-18", "shavvinne-b-16"],
    // Export Bureau, Central Bank, Monarch Family, Universities, Veterans
    market: ["dragonara-b-5", "horsard-b-5", "shavvinne-b-12", "smarbbit-b-16", "horsard-b-9"],
    // NGOs, Patrons of Art, Arms Dealers, Gardeners, The Proletariats, Local Politicians
    deckTop: ["smarbbit-b-17", "shavvinne-b-4", "horsard-b-16", "dragonara-b-6", "smarbbit-b-15", "shavvinne-b-13"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "elections",
      view: "table",
      title: "Win elections",
      body: "Two parties compete for the Vitalic Union: you lead the Liberals, Mildred the Socialists. Four General Elections hide in the deck. Each one starts an election, and whoever wins the last one wins the game. So: win elections.",
    },
    {
      kind: "explain",
      target: "lanes",
      view: "districts",
      title: "Four districts",
      body: "Shavvinne, Horsard, Dragonara, and Smarbbit, one column each. Your cards go below each district's plate, Mildred's above it. The plate shows both players' influence there.",
    },
    {
      kind: "explain",
      target: "your-hand",
      view: "districts",
      title: "Civil cards",
      body: "Every card belongs to a district: its color and the tag under its name say which. Civil cards carry a number from 3 to 9: the influence they give in their district.",
    },
    {
      kind: "explain",
      target: "turn",
      title: "Your turn",
      body: "At Town Hall a turn has two steps. Action: one main action, like playing a card. Income: collect cards for your next turn. The turn panel always says what's next.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Play a civil card",
      body: "Play Roman Church: select it in your hand, then select the Shavvinne district.",
      expect: { type: "playCivil", card: "shavvinne-b-1" },
      hint: "For now, play Roman Church in Shavvinne.",
      stages: {
        "play-selected": { body: "Now select the Shavvinne district: it lights up.", target: "lane:shavvinne" },
      },
    },
    {
      kind: "explain",
      target: "lane:shavvinne",
      view: "districts",
      title: "Influence wins districts",
      body: "Roman Church gives you 9 influence in Shavvinne. When an election is counted, whoever has more influence in a district wins it. A tie wins it for nobody.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income and the hand limit",
      body: "Take any one card from the Market; it refills from the deck. Your hand limit is 5: you take a Market card only while you hold fewer than 5, then draw one more from the deck if you're still under. This brings you to 5, so no draw today.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "explain",
      target: "lane:horsard",
      view: "districts",
      title: "Mildred's alliance",
      body: "Mildred played Order of Knights in Horsard. It's an alliance: a handshake and an ability instead of a number, so it gives no influence itself. Each player may have one alliance per district.",
    },
    {
      kind: "explain",
      target: "partisans",
      title: "Five electorates",
      body: "An election counts five electorates: the four districts, and the Council of Lords, won by whoever has more handshakes across their alliances in play. Win more electorates than your opponent to win the election. Lords: Mildred 1, you 0.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Your own Knights",
      body: "Answer with your Order of Knights. It reads: \"Each of your Dragonara civil cards now gives you +2 influence. Conspiracy cannot be played in Dragonara.\" Play it in Dragonara.",
      expect: { type: "playAlliance", card: "dragonara-a-1" },
      hint: "Play your Order of Knights in Dragonara.",
      stages: {
        "play-selected": { body: "Now select Dragonara.", target: "lane:dragonara" },
      },
    },
    {
      kind: "explain",
      target: "lane:dragonara",
      view: "districts",
      title: "Knights at work",
      body: "Your two Dragonara civils now give 8 and 7: 15 influence to Mildred's 12. And the Lords are tied 1–1, which wins them for nobody.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take any card from the Market. You hold 4, so one card brings you back to your limit of 5.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
    {
      kind: "explain",
      now: true,
      target: "partisans",
      title: "Count it up",
      body: "You'd win Shavvinne and Dragonara; Horsard, Smarbbit, and the Lords are tied. 2 electorates to 0: if the votes were counted tonight, the election would be yours.",
    },
  ],
  script: [
    { type: "playAlliance", card: "horsard-a-2", say: "Every district needs friends, dear. Knights for Horsard!" },
    { type: "takeMarket", say: "Ooh, I'll take this pretty one." },
  ],
};

const doorstep: Lesson = {
  id: "doorstep",
  act: "townHall",
  title: "Crisis at the Doorstep",
  summary: "Snatch a conspiracy before Mildred does, turn the wreckage into support, and win the final election.",
  teaches: ["Conspiracies", "Support piles", "Election night", "Civil Victory"],
  opponent: "mildred",
  intro: "The final election, dear, and my bankers have Horsard sewn up. Nothing short of a scandal could shift them.",
  outro: "A scandal! At my Town Hall! Well. You're wasted here, dear. I'll write to an old friend at the Capital.",
  lose: "Ah well. The bankers always win in the end, dear.",
  hide: TOWN_HALL_HIDE,
  skipPolitics: true,
  scenario: {
    seed: 102,
    // All four General Elections are out: this is the final election, with 3 Market cards left.
    election: { out: 4, thisPhase: 1 },
    you: {
      party: LIBERAL,
      // Radio Stations 4, Dune Clans 4, Buddhist Traders 3
      hand: ["smarbbit-b-9", "dragonara-b-16", "shavvinne-b-17"],
      // Roman Church 9 in Shavvinne; Veterans 3 in Horsard
      tableau: { shavvinne: ["shavvinne-b-1"], horsard: ["horsard-b-9"] },
      // Masons Guild in your Horsard support pile
      support: { horsard: ["horsard-b-18"] },
    },
    opponent: {
      party: PartyId.Socialist,
      // Tinkers 5, Anarchists 3, Influencers 4
      hand: ["dragonara-b-7", "smarbbit-b-18", "horsard-b-17"],
      // Farmers 3 in Shavvinne; Bracket Banks 9, Arms Dealers 5 in Horsard; Gardeners 5 in Dragonara
      tableau: { shavvinne: ["shavvinne-b-8"], horsard: ["horsard-b-1", "horsard-b-16"], dragonara: ["dragonara-b-6"] },
    },
    senate: ["shavvinne-b-18", "horsard-b-4", "dragonara-b-18", "smarbbit-b-10", "shavvinne-b-14"],
    // Grassroot Media (Horsard conspiracy), Universities, Transportations
    market: ["horsard-c-1", "smarbbit-b-16", "horsard-b-6"],
    // Mining Expats, Time Travelers, Workers Union
    deckTop: ["shavvinne-b-16", "dragonara-b-17", "horsard-b-15"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "elections",
      view: "table",
      title: "Election night",
      body: "When a General Election turns up, an election starts: the Market grows to 8 and stops refilling. When a turn ends with the Market empty, the votes are counted. All four General Elections are out, so this is the final election: its winner takes Civil Victory, and the game.",
    },
    {
      kind: "explain",
      target: "partisans",
      title: "Behind on the count",
      body: "You'd win Shavvinne; Mildred wins Horsard (14 to 4) and Dragonara; Smarbbit and the Lords are empty. 1 electorate to 2, with 3 cards left in the Market.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Claim Smarbbit",
      body: "Nobody holds Smarbbit yet. Play Radio Stations there.",
      expect: { type: "playCivil", card: "smarbbit-b-9" },
      hint: "Play Radio Stations in Smarbbit.",
      stages: {
        "play-selected": { body: "Now select Smarbbit.", target: "lane:smarbbit" },
      },
    },
    {
      kind: "explain",
      target: "market",
      view: "table",
      title: "A conspiracy for sale",
      body: "2 electorates each. A tie goes to whoever won the districts holding more civil cards (both players' count): Mildred's hold 4, yours 3. But look in the Market: Grassroot Media, a conspiracy (the flame). Playing one wipes its district, both players' cards. Mildred has her eye on it.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Take it first",
      body: "Whoever holds Grassroot Media decides Horsard. Take it before Mildred does.",
      expect: { type: "takeMarket", card: "horsard-c-1" },
      hint: "Take Grassroot Media from the Market.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Wipe Horsard",
      body: "Mildred missed her chance. Play Grassroot Media: select it, then Horsard.",
      expect: { type: "playConspiracy", card: "horsard-c-1" },
      hint: "Play Grassroot Media into Horsard.",
      stages: {
        "play-selected": { body: "Now select Horsard (it's marked Wipe this district).", target: "lane:horsard" },
      },
    },
    {
      kind: "explain",
      target: "lane:horsard",
      view: "districts",
      title: "Support piles",
      body: "Every wiped card went to its owner's support pile under Horsard, and the conspiracy to yours. Each card in your support pile is worth 1 influence in its district: you have 3 (Masons Guild, Veterans, Grassroot Media), Mildred 2. Horsard is yours, 3 to 2.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Count the votes",
      body: "Take the last card. Your turn ends with the Market empty, and the final votes are counted: Shavvinne, Horsard, and Smarbbit make 3 electorates to 1.",
      expect: { type: "takeMarket" },
      hint: "Take the last Market card.",
    },
  ],
  script: [
    { type: "playCivil", card: "dragonara-b-7", say: "My conspiracy! Oh, you cheeky thing. Tinkers to Dragonara, then." },
    { type: "takeMarket", card: "smarbbit-b-16" },
  ],
};

// --- The Capital ----------------------------------------------------------------------------------

const legislative: Lesson = {
  id: "legislative",
  act: "capital",
  title: "The Legislative Branch",
  summary: "Seat Senators, win a vote to change a district's policy, and count the symbols on the table.",
  teaches: ["Politics", "The Senate", "Propose Policy", "Symbols", "Ideological Victory"],
  opponent: "crane",
  intro:
    "Mildred writes that you're wasted on Town Hall. She's rarely wrong. Up here we do everything over the table, in full view. It's far more effective.",
  outro: "Three Economy symbols. Admirably stubborn. A law gets you only so far, though; the fourth copy comes from the executive. Tomorrow.",
  dim: ["decrees", "supply", "elections"],
  scenario: {
    seed: 103,
    // Populist Forum (Economy) already in force in Dragonara.
    policies: { dragonara: PolicyId.DragonaraB },
    you: {
      party: LIBERAL,
      // Order of Knights (Horsard alliance), TuWang Gang 8, Teachers 4, Urban Planners 5, Fire Breathers 3
      hand: ["horsard-a-1", "shavvinne-b-2", "shavvinne-b-15", "horsard-b-7", "dragonara-b-9"],
      // Patrons of Art 5 in Shavvinne
      tableau: { shavvinne: ["shavvinne-b-4"] },
    },
    opponent: {
      party: PartyId.Conservative,
      // Conservatives 8, Buddhist Traders 3, Influencers 4
      hand: ["smarbbit-b-13", "shavvinne-b-17", "horsard-b-17"],
      // Grand Maester 7, Monarch Family 6 in Shavvinne
      tableau: { shavvinne: ["shavvinne-b-3", "shavvinne-b-12"] },
    },
    // The rulebook's example: People's Press, Local Politicians 5, Civil Advocates 4,
    // Financial Bankers, Broken Chains = 7 votes.
    senate: ["smarbbit-a-4", "shavvinne-b-13", "shavvinne-b-14", "horsard-a-6", "dragonara-c-2"],
    // Export Bureau, Central Bank, NGOs, Transportations, Programmers
    market: ["dragonara-b-5", "horsard-b-5", "smarbbit-b-17", "horsard-b-6", "dragonara-b-14"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "turn",
      title: "Politics",
      body: "Up here, a turn has a step between Action and Income: Politics. Do one of four things: Influence Senate, Propose Policy, Fund a monument, or Declare a victory. Or skip it. Victories (all but Civil) are only ever declared here.",
    },
    {
      kind: "explain",
      target: "senate",
      view: "table",
      title: "The Senate",
      body: "Five Senators, always five. Each carries votes: civil and conspiracy cards 1, alliances 2. This Senate holds 7. Convince more than half (4 of 7) and you may change one district's policy.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Main action first",
      body: "Play Teachers in Shavvinne.",
      expect: { type: "playCivil", card: "shavvinne-b-15" },
      hint: "Play Teachers in Shavvinne.",
      stages: {
        "play-selected": { body: "Now select Shavvinne.", target: "lane:shavvinne" },
      },
    },
    {
      kind: "explain",
      target: "senate",
      view: "table",
      title: "Count the votes",
      body: "Reveal cards from your hand to convince Senators: a civil Senator by a higher civil of its district, an alliance Senator by an alliance of its district, a conspiracy never. Your Order of Knights (a Horsard alliance) convinces Financial Bankers: 2 votes. TuWang Gang, a Shavvinne 8, beats Local Politicians 5 and Civil Advocates 4: 2 more. That's 4.",
    },
    {
      kind: "do",
      target: "action-cards",
      title: "Propose Policy",
      body: "Choose Propose policy, beside your hand. Three parts follow: reveal two cards, choose the policy, then discard one of the cards you revealed.",
      expect: { type: "proposePolicy", district: District.Horsard, policy: PolicyId.HorsardA },
      hint: "Propose Economic Reform in Horsard, revealing Order of Knights and TuWang Gang.",
      stages: {
        "propose-reveal": {
          body: "Select Order of Knights and TuWang Gang in your hand to reveal them. The Senators they convince light up, and the vote count shows above the Senate.",
          target: "your-hand",
        },
        "propose-passing": { body: "4 of 7 votes: a majority. Now press Choose a policy in the turn panel.", target: "turn" },
        "propose-choosing": {
          body: "You may change a district where you convinced a Senator. Choose Economic Reform, in Horsard. It's the change this lesson is about, so the others are closed.",
        },
        "propose-discard": {
          body: "Last part: a proposal that passes costs one of the cards you revealed. Select Order of Knights or TuWang Gang to discard it. The other goes back to your hand.",
          target: "your-hand",
        },
      },
    },
    {
      kind: "explain",
      target: "lane:horsard",
      view: "districts",
      title: "Economic Reform",
      body: "\"Each played card in Horsard, even alliance, gains +3 influence.\" Policies apply to both players, and change one notch at a time: neutral to a side, or a side back to neutral.",
    },
    {
      kind: "explain",
      target: "center-band",
      view: "districts",
      title: "Symbols",
      body: "Parties, policies, monuments, and decrees each carry a political symbol: Authority, Economy, Science, or Justice. Your party, the Liberals, shows Economy, and so do Populist Forum and now Economic Reform: 3 Economy symbols on the table, more than any other.",
    },
    {
      kind: "explain",
      target: "center-band",
      view: "districts",
      title: "Ideological Victory",
      body: "Declare it with a symbol that has at least 4 copies and more than any other, if you hold more private copies of it (your party) than your opponent. But each symbol is printed on only two policies, so a party plus policies stops at 3. The 4th copy has to come from a decree: that's tomorrow's lesson.",
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
      title: "Crane seats a Senator",
      body: "Crane used Influence Senate: his card took the leftmost seat, everyone shifted right, and the rightmost Senator, Broken Chains, went to his Dragonara support pile. A pushed-out Senator counts like any card in your support pile.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Main action",
      body: "Play Urban Planners in Horsard. It's a 5, and Economic Reform makes it count 8.",
      expect: { type: "playCivil", card: "horsard-b-7" },
      hint: "Play Urban Planners in Horsard.",
      stages: {
        "play-selected": { body: "Now select Horsard.", target: "lane:horsard" },
      },
    },
    {
      kind: "do",
      target: "senate",
      view: "table",
      title: "Influence Senate",
      body: "Your turn to seat a Senator. Select a card in your hand (Fire Breathers is easy to spare) and choose Seat in the Senate. The rightmost Senator, Financial Bankers, joins your Horsard support pile.",
      expect: { type: "influenceSenate" },
      hint: "Seat any card from your hand in the Senate.",
      stages: {
        "seat-armed": { body: "Now choose Seat in the Senate in the turn panel.", target: "turn" },
      },
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Financial Bankers now sits in your Horsard support pile: +1 influence there. Take a Market card to end your turn.",
      expect: { type: "takeMarket" },
      hint: "Take any card from the Market.",
    },
  ],
  script: [
    { type: "playCivil", card: "smarbbit-b-13", say: "Conservatives, in Smarbbit. Tradition is a policy too." },
    { type: "influenceSenate", card: "shavvinne-b-17", say: "And a Senator of my own, if you don't mind." },
    { type: "takeMarket" },
  ],
};

const executive: Lesson = {
  id: "executive",
  act: "capital",
  title: "The Executive Branch",
  summary: "An election with two General Elections in it: win it, activate two decrees, and declare Political Victory.",
  teaches: ["Elections", "Decrees", "Political Victory"],
  opponent: "crane",
  intro: "Election night, and two General Elections in a single election. Whoever wins writes two decrees. I've drafted mine.",
  outro: "Two decrees, and you met both. Mildred was right about you. There's someone at the Old Palace you should meet. Be careful.",
  dim: ["supply"],
  scenario: {
    seed: 104,
    // Two General Elections came up in this election (2 decrees for its winner); 1 Market card left.
    election: { out: 2, thisPhase: 2 },
    // Populist Forum and Economic Reform (both Economy) in force.
    policies: { dragonara: PolicyId.DragonaraB, horsard: PolicyId.HorsardA },
    you: {
      party: LIBERAL,
      partisans: 1,
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
      // 6 support: Mining Expats, Buddhist Traders, Heritage Society (Shavvinne); Veterans, Masons Guild (Horsard); Think Tanks (Dragonara)
      support: { shavvinne: ["shavvinne-b-16", "shavvinne-b-17", "shavvinne-b-18"], horsard: ["horsard-b-9", "horsard-b-18"], dragonara: ["dragonara-b-13"] },
    },
    opponent: {
      party: PartyId.Conservative,
      // Fire Breathers 3, Farmers 3
      hand: ["dragonara-b-9", "shavvinne-b-8"],
      tableau: {
        // Monarch Family 6, Artisans 3
        shavvinne: ["shavvinne-b-12", "shavvinne-b-9"],
        // Order of Knights (alliance), Bracket Banks 9, Regulators 7
        horsard: ["horsard-a-1", "horsard-b-1", "horsard-b-14"],
        // Secret Service 7
        dragonara: ["dragonara-b-12"],
        // Conservatives 8
        smarbbit: ["smarbbit-b-13"],
      },
      // 1 support: Anarchists (Smarbbit)
      support: { smarbbit: ["smarbbit-b-18"] },
    },
    senate: ["shavvinne-b-13", "horsard-b-16", "dragonara-b-18", "smarbbit-b-9", "shavvinne-b-14"],
    // One card left: Export Giants
    market: ["horsard-b-12"],
    // Engineers, then the Market's refill after the election
    deckTop: ["dragonara-b-15", "shavvinne-b-4", "horsard-b-6", "smarbbit-b-8", "dragonara-b-14", "smarbbit-b-7"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "elections",
      view: "table",
      title: "Two General Elections",
      body: "An election is under way, and two General Elections came up during it. The winner activates one decree for each: two. One card is left in the Market; when a turn ends with it empty, the votes are counted.",
    },
    {
      kind: "explain",
      target: "partisans",
      title: "The count",
      body: "You win Shavvinne and Dragonara. Crane wins Horsard, Smarbbit (9 to your 6), and the Lords. 2 electorates to 3.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Swing Smarbbit",
      body: "NGOs is a Smarbbit 5. With Universities that's 11 to Crane's 9. Play it.",
      expect: { type: "playCivil", card: "smarbbit-b-17" },
      hint: "Play NGOs in Smarbbit.",
      stages: {
        "play-selected": { body: "Now select Smarbbit.", target: "lane:smarbbit" },
      },
    },
    {
      kind: "do",
      target: "turn",
      title: "Skip politics",
      body: "Nothing to declare yet. Skip politics.",
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
      target: "decrees",
      view: "table",
      title: "You won: two decrees",
      body: "3 electorates to 2! Decrees start inactive; once active, each is a goal for both players. Activate Imperium first: have more partisans than your opponent. You lead 1–0.",
      expect: { type: "activateDecree", decree: DecreeId.Imperium },
      hint: "Activate Imperium.",
    },
    {
      kind: "do",
      target: "decrees",
      view: "table",
      title: "The second decree",
      body: "Now Profectus: have 5 or more total support than your opponent (every card in all your support piles). You lead 6 to 1.",
      expect: { type: "activateDecree", decree: DecreeId.Profectus },
      hint: "Activate Profectus.",
    },
    {
      kind: "explain",
      now: true,
      target: "decrees",
      view: "table",
      title: "Political Victory",
      body: "Meet two active decrees at once and you may declare Political Victory in your Politics step. You meet both. Profectus shows Economy, too: your party, Populist Forum, Economic Reform, and Profectus make 4 Economy symbols, so Ideological Victory is in reach as well.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Main action",
      body: "Crane couldn't undo either decree. Take your main action: play any civil card.",
      expect: { type: "playCivil" },
      hint: "Play any civil card from your hand.",
    },
    {
      kind: "do",
      target: "action-cards",
      title: "Declare",
      body: "Declare Political Victory, beside your hand (Ideological wins just as well).",
      expect: { type: "declareVictory" },
      hint: "Declare Political Victory.",
    },
  ],
  script: [
    { type: "playCivil", card: "shavvinne-b-8", say: "Two decrees I can't touch. Well played. Farmers, for form's sake." },
    { type: "endPolitics" },
    { type: "takeMarket" },
  ],
};

// --- The Old Palace ---------------------------------------------------------------------------------

const untold: Lesson = {
  id: "untold",
  act: "palace",
  title: "The Untold Stories",
  summary: "Recruit partisans (once for free), build a monument, and win by force or by sheer numbers.",
  teaches: ["Partisans", "Free actions", "Monuments", "Military Victory", "Popularity Victory"],
  opponent: "vex",
  intro:
    "Crane sends me another one. The Grand Vizier's office went with the Vitalic Wars, you know. I didn't. Come: the Senate is for show. The real work happens out of sight.",
  outro: "Two victories in your pocket and you chose one. Discipline. Come back when you're ready to lead a party of your own.",
  dim: ["decrees", "elections"],
  scenario: {
    seed: 105,
    you: {
      party: LIBERAL,
      partisans: 1,
      hand: [
        // Film Industry 8, Urban Planners 5, Influencers 4 (Horsard)
        "horsard-b-3",
        "horsard-b-7",
        "horsard-b-17",
        // Liberalists 8, Socialists 8, The Capitalists 7, Habitat Directors 6, Radio Stations 4 (Smarbbit)
        "smarbbit-b-4",
        "smarbbit-b-5",
        "smarbbit-b-6",
        "smarbbit-b-8",
        "smarbbit-b-9",
      ],
      // Rebel Inc. (alliance) and Roman Church 9 in Shavvinne
      tableau: { shavvinne: ["shavvinne-a-4", "shavvinne-b-1"] },
      // Veterans (Horsard) and Anarchists (Smarbbit) in your support piles
      support: { horsard: ["horsard-b-9"], smarbbit: ["smarbbit-b-18"] },
    },
    opponent: {
      party: PartyId.Trinity,
      // Grand Justices 8, Fire Breathers 3, Masons Guild 3
      hand: ["dragonara-b-2", "dragonara-b-9", "horsard-b-18"],
      // Bracket Banks 9 in Horsard; Gardeners 5 in Dragonara
      tableau: { horsard: ["horsard-b-1"], dragonara: ["dragonara-b-6"] },
    },
    senate: ["shavvinne-b-18", "horsard-b-16", "dragonara-b-16", "shavvinne-b-12", "shavvinne-b-13"],
    // Export Bureau, Universities, Patrons of Art, Central Bank, Programmers
    market: ["dragonara-b-5", "smarbbit-b-16", "shavvinne-b-4", "horsard-b-5", "dragonara-b-14"],
    monuments: [MonumentId.ModelSociety, MonumentId.DragonGate, MonumentId.CivilService, MonumentId.SpaceAgency],
    // NGOs (your draw for building), Engineers (Market refill), Communists (your income draw), then Vex's refill and draw
    deckTop: ["smarbbit-b-17", "dragonara-b-15", "smarbbit-b-1", "shavvinne-b-14", "horsard-b-15"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "center-band",
      view: "districts",
      title: "Partisans",
      body: "Recruiting gains a partisan: discard 3 cards of one district from your hand (to your support pile). You can only recruit in a district where your support pile already holds a card. Lead by 3 partisans and you may declare Military Victory. You lead 1–0.",
    },
    {
      kind: "explain",
      target: "action-cards",
      view: "districts",
      title: "Free actions",
      body: "Rebel Inc., your Shavvinne alliance, reads: \"As a free action, you may recruit partisans. If you use this ability, get +2 partisans if you have fewer partisans.\" You lead, so it's the usual one. Free actions come on top of your one main action, each card's once per turn. It waits beside your hand.",
    },
    {
      kind: "do",
      target: "action-cards",
      view: "districts",
      title: "Recruit for free",
      body: "Choose Rebel Inc.: recruit, then select your three Horsard cards (your Horsard pile already holds Veterans) and confirm.",
      expect: { type: "freeAction", ability: "rebelInc", district: District.Horsard },
      hint: "Use Rebel Inc. to recruit with your three Horsard cards.",
      stages: {
        recruit: { body: "Select your three Horsard cards: Film Industry, Urban Planners, and Influencers.", target: "your-hand" },
        "recruit-ready": { body: "That's three. Confirm with Recruit in the turn panel.", target: "turn" },
      },
    },
    {
      kind: "explain",
      target: "supply",
      view: "table",
      title: "Monuments",
      body: "Permanent buildings with an ability and a political symbol. Build one as your main action by discarding 5 cards of its district from your hand (fewer once it's been funded: more on that soon). Four are available.",
    },
    {
      kind: "do",
      target: "action-cards",
      title: "Build Model Society",
      body: "Choose Build monument, select your five Smarbbit cards, then select Model Society.",
      expect: { type: "construct", monument: MonumentId.ModelSociety },
      hint: "Build Model Society with your five Smarbbit cards.",
      stages: {
        construct: { body: "Select your five Smarbbit cards.", target: "your-hand" },
        "construct-ready": { body: "That's five. Now select Model Society in the Monuments section.", target: "supply" },
      },
    },
    {
      kind: "explain",
      target: "lane:smarbbit",
      view: "districts",
      title: "Popularity",
      body: "Model Society is yours for good, and building drew you a card as Politics began. The five cards you spent went to your Smarbbit support pile: 6 to Vex's 0. Lead one district's support piles by 9 and you may declare Popularity Victory.",
    },
    {
      kind: "do",
      target: "turn",
      title: "Not yet",
      body: "Partisans 2–0, Smarbbit support 6–0: nothing to declare yet. Skip politics.",
      expect: { type: "endPolitics" },
      hint: "Skip politics for now.",
    },
    {
      kind: "do",
      target: "market",
      view: "table",
      title: "Income",
      body: "Take Universities, a Smarbbit card. You'll want three of them next turn.",
      expect: { type: "takeMarket", card: "smarbbit-b-16" },
      hint: "Take Universities from the Market.",
    },
    {
      kind: "explain",
      target: "supply",
      view: "table",
      title: "Fund a monument",
      body: "Vex tucked Fire Breathers under Dragon Gate. That's Fund a monument, the fourth Politics option: tuck one card of a monument's district under it, and it costs one card less to build, for either of you. Dragon Gate takes 4 Dragonara cards now, and whoever builds it takes Fire Breathers into their support pile too. It never drops below 1.",
    },
    {
      kind: "do",
      target: "action-cards",
      view: "districts",
      title: "Recruit again",
      body: "Your main action: recruit with your three Smarbbit cards. They'll land in your Smarbbit pile too.",
      expect: { type: "recruit", district: District.Smarbbit },
      hint: "Recruit with your three Smarbbit cards.",
      stages: {
        recruit: { body: "Select your three Smarbbit cards: NGOs, Universities, and Communists.", target: "your-hand" },
        "recruit-ready": { body: "That's three. Confirm with Recruit in the turn panel.", target: "turn" },
      },
    },
    {
      kind: "explain",
      target: "center-band",
      view: "districts",
      title: "Two ways to win",
      body: "Partisans 3–0, and Smarbbit support 9–0. Military Victory and Popularity Victory are both yours to declare.",
    },
    {
      kind: "do",
      target: "action-cards",
      view: "districts",
      title: "Declare",
      body: "Choose either victory, beside your hand.",
      expect: { type: "declareVictory" },
      hint: "Declare Military or Popularity Victory.",
    },
  ],
  script: [
    { type: "playCivil", card: "dragonara-b-2", say: "Grand Justices. The law remembers its friends." },
    { type: "fundMonument", card: "dragonara-b-9", monument: MonumentId.DragonGate, say: "A gift for Dragon Gate. Whoever builds it will thank me." },
    { type: "takeMarket" },
  ],
};

const starIsBorn: Lesson = {
  id: "star",
  act: "palace",
  title: "A Star is Born",
  summary: "A whole game against Vex, leading a party of your own. Win with any of the five victories.",
  teaches: ["Political parties", "Private symbols", "A full game"],
  opponent: "vex",
  // A fair test: Vex plays at the Normal level here.
  opponentLevel: "normal",
  intro: "No scripts, no second chances. Pick a party and lead it. I'll be leading mine.",
  outro: "…A star is born. The Union is yours. Do write; old men in palaces get lonely.",
  lose: "Not yet, my star. Shuffle up, and try me again.",
  scenario: { newGame: true },
  steps: [
    {
      kind: "explain",
      now: true,
      title: "Lead your own party",
      body: "A whole game, from the deal. Win with any of the five victories: Civil, Political, Military, Popularity, or Ideological. First, each player is dealt two parties and keeps one.",
    },
    {
      kind: "do",
      title: "Choose your party",
      body: "A party gives you a political symbol, four starting cards, and a monument that's sure to be up for building. Its symbol is a private copy: only your party and your monuments add those (policies and decrees are shared), and Ideological Victory needs more private copies of the symbol than your opponent.",
      expect: { type: "chooseParty" },
      hint: "Choose one of your two parties.",
    },
    {
      kind: "free",
      until: "victory",
      title: "Your game",
      body: "Everything you've learned counts. Watch the victory bands, and the banner that warns when Vex is close.",
      hint: "Pick one or two victories that suit your hand and party, and keep an eye on Vex's: the banner warns when he can declare next turn.",
    },
  ],
  script: [],
};

export const BASE_LESSONS: Lesson[] = [firstDay, doorstep, legislative, executive, untold, starIsBorn];
