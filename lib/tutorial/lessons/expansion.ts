/**
 * The Legacy & Diplomacy lessons ("Foreign Affairs"), against Grand Vizier Vex: events in the
 * Market, buying them, relations, legacy events, and the victories that start inactive.
 * Rules: docs/agents/game-rules.md#expansion-legacy--diplomacy and the expansion rulings in
 * open-questions.md.
 */
import { ExpansionVictory } from "../../cards/expansion.ts";
import { PartyId } from "../../cards/schema.ts";
import { VictoryKind } from "../../game/types.ts";
import type { Lesson } from "../lesson.ts";

const LIBERAL = PartyId.Liberal;

const RAILWAY_BONDS = "event-east-railway-bonds";
const DECLARATION = "event-west-declaration-of-universal-rights";

const foreignAffairs: Lesson = {
  id: "events",
  act: "foreign",
  expansion: true,
  title: "Foreign affairs",
  summary: "Events from the four World Powers: what they cost, how to buy one, and what it gives.",
  teaches: ["Events", "Event cost", "Relations"],
  opponent: "vex",
  intro: "You've met the Union's politicians. Now meet its neighbors. I know them all personally.",
  outro: "The East favors you. For a price, as always.",
  scenario: {
    seed: 201,
    expansion: {},
    you: {
      party: LIBERAL,
      // Influencers 4, Mining Expats 3, Winter Castles 3, Radio Stations 4
      hand: ["horsard-b-17", "shavvinne-b-16", "dragonara-b-18", "smarbbit-b-9"],
      tableau: { shavvinne: ["shavvinne-b-2"] },
    },
    opponent: {
      party: PartyId.Trinity,
      // The Proletariats 7, Fire Breathers 3, Masons Guild 3
      hand: ["smarbbit-b-15", "dragonara-b-9", "horsard-b-18"],
      tableau: { horsard: ["horsard-b-14"] },
    },
    senate: ["shavvinne-b-18", "horsard-b-16", "dragonara-b-16", "smarbbit-b-18", "shavvinne-b-15"],
    // Central Bank, Universities, Railway Bonds (East event), Monarch Family, Export Bureau
    market: ["horsard-b-5", "smarbbit-b-16", RAILWAY_BONDS, "shavvinne-b-12", "dragonara-b-5"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "market",
      view: "table",
      title: "Events",
      body: "Legacy & Diplomacy adds events from four World Powers: North, South, East, and West. One or two always sit in the Market among the other cards.",
    },
    {
      kind: "explain",
      target: "market",
      view: "table",
      title: "What an event costs",
      body: "The ◆ badge: one card for each non-event card to the event's right, fixed for the whole turn. Railway Bonds costs 2. New cards enter on the left and push older ones right, so events get cheaper; one that starts a turn in the last 2 spots leaves at the next refill.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Main action",
      body: "Play Influencers in Horsard.",
      expect: { type: "playCivil", card: "horsard-b-17" },
      hint: "Play Influencers in Horsard.",
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
      title: "Buy an event",
      body: "At income you may buy an event instead of taking a card. Select Railway Bonds, pay 2 cards from your hand (they go to your support piles), and play it for its effect.",
      expect: { type: "buyEvent", event: RAILWAY_BONDS, use: "effect" },
      hint: "Buy Railway Bonds and play it for its effect.",
    },
    {
      kind: "explain",
      now: true,
      target: "world",
      view: "table",
      title: "In effect",
      body: "Railway Bonds: \"As a free action, take a Horsard card from Market.\" East effects belong to their buyer alone. You also gained +1 relation with the East, and playing an event for its effect draws you a card. (You could have played it as a civil card instead: ZMK Locomotives, 8 in Horsard.)",
    },
    {
      kind: "free",
      until: "turnEnd",
      title: "Your turn",
      body: "Use Railway Bonds: it appears beside your hand as a free action. Take a Horsard card from the Market, play it, then finish your turn.",
      hint: "Choose Railway Bonds, take Central Bank, play it in Horsard, skip politics, then take a Market card.",
      solution: [
        { type: "freeAction", ability: "eastTake", card: "horsard-b-5" },
        { type: "playCivil", card: "horsard-b-5" },
        { type: "endPolitics" },
        { type: "takeMarket" },
      ],
    },
  ],
  script: [
    { type: "playCivil", card: "smarbbit-b-15", say: "Foreign friends? Mine are older. And better paid." },
    { type: "endPolitics" },
    { type: "takeMarket", card: "smarbbit-b-16" },
  ],
};

const worldOrder: Lesson = {
  id: "diplomacy",
  act: "foreign",
  expansion: true,
  title: "A new world order",
  summary: "Victories that start inactive, legacy events that switch them on, and Diplomatic Victory.",
  teaches: ["Legacy events", "Inactive victories", "Diplomatic Victory"],
  opponent: "vex",
  intro: "The East owes me favors. The West? Nobody has asked them yet.",
  outro: "The world chose you. Remarkable. Next time, I'll choose the world.",
  lose: "The world is a small place, and I own most of it.",
  scenario: {
    seed: 202,
    expansion: {},
    you: {
      party: LIBERAL,
      relations: { north: 1, south: 1 },
      // Influencers 4, Mining Expats 3, Winter Castles 3, Radio Stations 4
      hand: ["horsard-b-17", "shavvinne-b-16", "dragonara-b-18", "smarbbit-b-9"],
      tableau: { shavvinne: ["shavvinne-b-2"] },
    },
    opponent: {
      party: PartyId.Trinity,
      relations: { east: 1 },
      hand: ["smarbbit-b-15", "dragonara-b-9", "horsard-b-18"],
      tableau: { horsard: ["horsard-b-14"] },
    },
    senate: ["shavvinne-b-18", "horsard-b-16", "dragonara-b-16", "smarbbit-b-18", "shavvinne-b-15"],
    // Monarch Family, Central Bank, Declaration of Universal Rights (West legacy), Export Bureau, Universities
    market: ["shavvinne-b-12", "horsard-b-5", DECLARATION, "dragonara-b-5", "smarbbit-b-16"],
    // Civil cards for the refills and draws, so your next turn has a civil to play.
    // Grand Maester 7, Patrons of Art 5, Engineers 5, Workers Union 6
    deckTop: ["shavvinne-b-3", "shavvinne-b-4", "dragonara-b-15", "horsard-b-15"],
  },
  steps: [
    {
      kind: "explain",
      now: true,
      target: "victory-cards",
      view: "table",
      title: "Victories start off",
      body: "With Legacy & Diplomacy, only Civil and Political Victory are active from the start. Military, Popularity, Ideological, Cultural, and Diplomatic are off until a legacy event (the trophy) switches one on.",
    },
    {
      kind: "explain",
      target: "world",
      view: "table",
      title: "Relations",
      body: "Every event you buy is +1 relation with its World Power. Diplomatic Victory: a higher relation than your opponent with 3 of the 4 powers. You lead the North and the South; the West is 0–0.",
    },
    {
      kind: "do",
      target: "your-hand",
      view: "districts",
      title: "Main action",
      body: "Play Influencers in Horsard.",
      expect: { type: "playCivil", card: "horsard-b-17" },
      hint: "Play Influencers in Horsard.",
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
      title: "A legacy event",
      body: "Buy Declaration of Universal Rights (pay 2 cards). A legacy event offers two choices: discard every played West event, or activate a victory. Activate Diplomatic Victory.",
      expect: { type: "buyEvent", event: DECLARATION, use: "legacyActivate", victory: ExpansionVictory.Diplomatic },
      hint: "Buy Declaration of Universal Rights and use it to activate Diplomatic Victory.",
    },
    {
      kind: "explain",
      now: true,
      target: "world",
      view: "table",
      title: "Three of four",
      body: "Diplomatic Victory is on, and the purchase made you +1 with the West: you now lead 3 of the 4 powers. Declare it in your next Politics step, if Vex hasn't caught up by then.",
    },
    {
      kind: "free",
      until: "victory",
      title: "Your turn",
      body: "Take your main action, then declare Diplomatic Victory in Politics.",
      hint: "Play any civil card, then choose Declare Diplomatic Victory.",
      solution: [{ type: "playCivil" }, { type: "declareVictory", victory: VictoryKind.Diplomatic }],
    },
  ],
  script: [
    { type: "playCivil", card: "smarbbit-b-15", say: "Diplomacy? How quaint." },
    { type: "endPolitics" },
    { type: "takeMarket", say: "I'll keep my friends close. And my cards closer." },
  ],
};

export const EXPANSION_LESSONS: Lesson[] = [foreignAffairs, worldOrder];
