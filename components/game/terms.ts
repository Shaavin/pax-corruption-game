/** Plain definitions of the words the table uses (from the rules; Joe's cards are the authority). */
export type Term = { term: string; meaning: string };

export const TERMS: Term[] = [
  {
    term: "Influence (Inf)",
    meaning:
      "Your strength in a district: the numbers on your civil cards there, plus 1 for each card in your support pile there, plus card effects. More influence wins the district at an election.",
  },
  {
    term: "Support pile (Pop)",
    meaning:
      "Where your discarded cards go, one pile per district. Each card is 1 influence there. Lead the other player by 9 cards in one district for Popularity Victory.",
  },
  {
    term: "Electorate",
    meaning:
      "One of the 5 prizes in an election: the 4 districts and the Council of Lords. Whoever wins more electorates wins the election.",
  },
  {
    term: "Electors",
    meaning:
      "The cards at stake in an electorate (civil cards in a district; alliance cards for the Council of Lords). If both players win the same number of electorates, more electors in the ones you won breaks the tie.",
  },
  {
    term: "Council of Lords (Lords)",
    meaning: "The 5th electorate. Won by having more alliance handshake symbols in play than the other player.",
  },
  {
    term: "Partisans",
    meaning:
      "How many times you've recruited (discard 3 cards of one district; you need at least one card in that district's support pile). Lead by 3 for Military Victory.",
  },
  {
    term: "General Election",
    meaning:
      "Four are hidden in the deck. When one turns up, the Market fills to 8 cards and stops refilling; the election is scored once the Market is empty. The last one decides Civil Victory.",
  },
  { term: "Incumbent", meaning: "The winner of the previous election. Wins an election that's still tied after electors." },
  {
    term: "Decree",
    meaning:
      "A shared objective. Election winners activate them; active decrees add shared symbols. Meet any two active decrees at once for Political Victory.",
  },
  {
    term: "Policy",
    meaning:
      "Each district's law, changed with Propose Policy (from Neutral to a side, or back to Neutral). An active policy adds a shared symbol.",
  },
  {
    term: "Senate",
    meaning:
      "Five face-up cards. Civil and conspiracy cards carry 1 vote, alliances 2. In Politics you may seat a card (the rightmost Senator goes to your support pile) or reveal cards that convince more than half the votes to change a policy.",
  },
  {
    term: "Symbols",
    meaning:
      "Chart, crown, atom, and scales. Private copies come from your party and monuments; shared copies from policies and active decrees. Ideological Victory: the most copies of one symbol (at least 4), with more private copies of it than the other player.",
  },
  {
    term: "Main action / free action",
    meaning:
      "Each turn you take exactly one main action (play a card, recruit, or build a monument). Free actions come from your alliances and monuments, each once per turn.",
  },
  { term: "Hand limit", meaning: "Usually 5. Going over is fine; it only stops you taking or drawing cards at Income." },
  { term: "Monument", meaning: "Built by discarding 5 cards of its district. Its ability is yours for the rest of the game." },
];

export const EXPANSION_TERMS: Term[] = [
  {
    term: "Event",
    meaning:
      "Legacy & Diplomacy cards in the Market, bought at Income instead of taking a card. Each costs one card per non-event card to its right.",
  },
  {
    term: "World Powers and relations",
    meaning:
      "North, South, East, and West. Buying an event gives +1 relation with its power. A higher relation with 3 of the 4 powers is Diplomatic Victory, once a legacy event activates it.",
  },
];
