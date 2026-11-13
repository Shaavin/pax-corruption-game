/**
 * Legacy & Diplomacy expansion cards, transcribed from the current TTS faces
 * (decks 8–11: events, 12–16: victory cards, 1: player aid).
 *
 * Each regular event is double-sided in use: bought from the Market, it is
 * played either for its **event effect** (common area) or **as a civil card**
 * under its second name, value, and district. Legacy events (trophy icon) have
 * no civil side: "Discard played <power> cards — OR — Activate a Victory Condition."
 *
 * The civil-side value is printed upside down in the corners, like base civils.
 */
import { DecreeId, District, type DecreeIdValue, type DistrictId } from "./schema.ts";

export const WorldPower = {
  North: "north",
  South: "south",
  East: "east",
  West: "west",
} as const;
export type WorldPowerId = (typeof WorldPower)[keyof typeof WorldPower];
export const WORLD_POWERS = Object.values(WorldPower);

export const WORLD_POWER_NAME: Record<WorldPowerId, string> = {
  north: "The North",
  south: "The South",
  east: "The East",
  west: "The West",
};

/** What a regular event does while it sits in the common area. Wording is the printed text. */
export type EventEffect =
  /** East: "Revealed <district> cards do not occupy hand limit." */
  | { type: "handLimitExempt"; district: DistrictId }
  /** East: "As a free action, take a <district> card from Market." */
  | { type: "takeFromMarket"; district: DistrictId }
  /** North: "Military victory now requires +1 partisans to declare." */
  | { type: "militaryLead" }
  /** North: "Flip over Pax <decree> to the other side, when in effect." */
  | { type: "flipDecree"; decree: DecreeIdValue }
  /** South: "Influence in <district> is now reduced to player's support." */
  | { type: "influenceIsSupport"; district: DistrictId }
  /** South: "<district> cards in Senate are always convinced." */
  | { type: "senateConvinced"; district: DistrictId }
  /** West: "Disable all icons in <district> for ideological victory." */
  | { type: "disableIcons"; district: DistrictId }
  /** West: "District support in <district> remains at zero." */
  | { type: "supportZero"; district: DistrictId };

type EventBase = {
  id: string;
  /** Event name (top of the card). */
  name: string;
  art: string;
  power: WorldPowerId;
};

export type RegularEventCard = EventBase & {
  kind: "event";
  legacy: false;
  district: DistrictId;
  text: string;
  effect: EventEffect;
  /** Name when played as a civil card (bottom of the card). */
  civilName: string;
  /** Civil-side value. */
  influence: number;
};

export type LegacyEventCard = EventBase & {
  kind: "event";
  legacy: true;
  text: string;
};

export type EventCard = RegularEventCard | LegacyEventCard;

/** Expansion victories. Civil and Political are always active (base rules). */
export const ExpansionVictory = {
  Military: "military",
  Ideological: "ideological",
  Popularity: "popularity",
  Cultural: "cultural",
  Diplomatic: "diplomatic",
} as const;
export type ExpansionVictoryId = (typeof ExpansionVictory)[keyof typeof ExpansionVictory];

export type VictoryCardDef = {
  id: ExpansionVictoryId;
  name: string;
  /** Printed condition (both sides). */
  text: string;
  /** Title on the active side. */
  title: string;
  art: string;
  inactiveArt: string;
};

const LEGACY_TEXT = (power: string) => `Discard played ${power} cards. — OR — Activate a Victory Condition.`;

const D = District;

function regular(
  power: WorldPowerId,
  slug: string,
  name: string,
  district: DistrictId,
  effect: EventEffect,
  text: string,
  civilName: string,
  influence: number,
): RegularEventCard {
  return {
    id: `event-${power}-${slug}`,
    kind: "event",
    legacy: false,
    power,
    name,
    art: `/cards/expansion/events/${power}-${slug}.png`,
    district,
    effect,
    text,
    civilName,
    influence,
  };
}

function legacy(power: WorldPowerId, slug: string, name: string): LegacyEventCard {
  const label = power.charAt(0).toUpperCase() + power.slice(1);
  return {
    id: `event-${power}-${slug}`,
    kind: "event",
    legacy: true,
    power,
    name,
    art: `/cards/expansion/events/${power}-${slug}.png`,
    text: LEGACY_TEXT(label),
  };
}

const exempt = (district: DistrictId, label: string) =>
  [{ type: "handLimitExempt", district } as const, `Revealed ${label} cards do not occupy hand limit.`] as const;
const take = (district: DistrictId, label: string) =>
  [{ type: "takeFromMarket", district } as const, `As a free action, take a ${label} card from Market.`] as const;
const military = [{ type: "militaryLead" } as const, "Military victory now requires +1 partisans to declare."] as const;
const flip = (decree: DecreeIdValue, label: string) =>
  [{ type: "flipDecree", decree } as const, `Flip over Pax ${label} to the other side, when in effect.`] as const;
const influence = (district: DistrictId, label: string) =>
  [{ type: "influenceIsSupport", district } as const, `Influence in ${label} is now reduced to player's support.`] as const;
const convinced = (district: DistrictId, label: string) =>
  [{ type: "senateConvinced", district } as const, `${label} cards in Senate are always convinced.`] as const;
const icons = (district: DistrictId, label: string) =>
  [{ type: "disableIcons", district } as const, `Disable all icons in ${label} for ideological victory.`] as const;
const zero = (district: DistrictId, label: string) =>
  [{ type: "supportZero", district } as const, `District support in ${label} remains at zero.`] as const;

/** All 40 events in TTS order (deck 8 East, 9 North, 10 South, 11 West). */
export const EVENTS: EventCard[] = [
  // East (deck 8)
  regular("east", "magic-realms", "Magic Realms", D.Dragonara, ...exempt(D.Dragonara, "Dragonara"), "Silicon Necropolis", 8),
  regular("east", "world-factory", "World Factory", D.Dragonara, ...take(D.Dragonara, "Dragonara"), "Kawasaki Energy", 11),
  legacy("east", "chokehold-of-the-black-blood", "Chokehold of the Black Blood"),
  legacy("east", "zirvixynol-the-cancer-treatment", "Zirvixynol the Cancer Treatment"),
  regular("east", "private-islands", "Private Islands", D.Horsard, ...exempt(D.Horsard, "Horsard"), "Economic Zones", 8),
  regular("east", "railway-bonds", "Railway Bonds", D.Horsard, ...take(D.Horsard, "Horsard"), "ZMK Locomotives", 8),
  regular("east", "muhran-mines", "Muhran Mines", D.Shavvinne, ...take(D.Shavvinne, "Shavvinne"), "Li, Xu, & Tan Co.", 7),
  regular("east", "rocky-bunkers", "Rocky Bunkers", D.Shavvinne, ...exempt(D.Shavvinne, "Shavvinne"), "Bav'yan Messiah", 11),
  regular("east", "ublozisky-cartels", "Ublozisky Cartels", D.Smarbbit, ...take(D.Smarbbit, "Smarbbit"), "Hotel Kavera", 9),
  regular("east", "unaccounted-pop", "Unaccounted Pop.", D.Smarbbit, ...exempt(D.Smarbbit, "Smarbbit"), "Urban Slums", 9),
  // North (deck 9)
  regular("north", "morph-wizards", "Morph Wizards", D.Dragonara, ...military, "Aluminum Bots", 10),
  regular("north", "science-guild", "Science Guild", D.Dragonara, ...flip(DecreeId.Academia, "Academia"), "AI Engineers", 10),
  regular("north", "insurance-debt", "Insurance Debt", D.Horsard, ...flip(DecreeId.Profectus, "Profectus"), "Reserve Governor", 10),
  regular("north", "siberian-bastion", "Siberian Bastion", D.Horsard, ...military, "V-3rd Brigade", 10),
  legacy("north", "gospel-of-the-hudson-aurora", "Gospel of the Hudson Aurora"),
  legacy("north", "novgok-conquest-austerity-crisis", "Novgök Conquest Austerity Crisis"),
  regular("north", "reverend-mother", "Reverend Mother", D.Shavvinne, ...military, "Papal Cash Flows", 10),
  regular("north", "treaty-of-kvo", "Treaty of Kvo", D.Shavvinne, ...flip(DecreeId.Imperium, "Imperium"), "Alpine Marines", 10),
  regular("north", "civil-crackdown", "Civil Crackdown", D.Smarbbit, ...flip(DecreeId.DeJures, "de Jures"), "Veronica Ruiz", 10),
  regular("north", "neighborhoods", "Neighborhoods", D.Smarbbit, ...military, "NK-14 Snipers", 10),
  // South (deck 10)
  regular("south", "digital-electors", "Digital Electors", D.Dragonara, ...influence(D.Dragonara, "Dragonara"), "Voice of Vitali", 8),
  regular("south", "thunder-bail-out", "Thunder Bail-out", D.Dragonara, ...convinced(D.Dragonara, "Dragonara"), "Treaty of Nadak", 8),
  regular("south", "migrant-voters", "Migrant Voters", D.Horsard, ...influence(D.Horsard, "Horsard"), "Sai's Night Show", 8),
  regular("south", "pari-passu", "Pari Passu", D.Horsard, ...convinced(D.Horsard, "Horsard"), "Guild of Traders", 11),
  regular("south", "clans-of-massacre", "Clans of Massacre", D.Shavvinne, ...influence(D.Shavvinne, "Shavvinne"), "Sabe Turowaki", 7),
  regular("south", "podium-baptism", "Podium Baptism", D.Shavvinne, ...convinced(D.Shavvinne, "Shavvinne"), "Royal Legate", 7),
  regular("south", "infiltrated-bureau", "Infiltrated Bureau", D.Smarbbit, ...influence(D.Smarbbit, "Smarbbit"), "Minister of Water", 11),
  regular("south", "silenced-hill", "Silenced Hill", D.Smarbbit, ...convinced(D.Smarbbit, "Smarbbit"), "Dark Triangle", 9),
  legacy("south", "failures-of-the-democracy", "Failures of the Democracy"),
  legacy("south", "sjevstad-and-cacao-gangster-plot", "Sjevstäd & Cacaõ Gangster Plot"),
  // West (deck 11)
  regular("west", "ai-singularity", "AI Singularity", D.Dragonara, ...icons(D.Dragonara, "Dragonara"), "Human's Future", 2),
  regular("west", "wakers-ecstasy", "Wakers' Ecstasy", D.Dragonara, ...zero(D.Dragonara, "Dragonara"), "Rights of Illusion", 2),
  regular("west", "agents-in-power", "Agents in Power", D.Horsard, ...zero(D.Horsard, "Horsard"), "Corruption Purge", 2),
  regular("west", "probabilisticism", "Probabilisticism", D.Horsard, ...icons(D.Horsard, "Horsard"), "School of Neglect", 2),
  regular("west", "imperial-exams", "Imperial Exams", D.Shavvinne, ...icons(D.Shavvinne, "Shavvinne"), "5-Stage Republic", 2),
  regular("west", "puppet-legate", "Puppet Legate", D.Shavvinne, ...zero(D.Shavvinne, "Shavvinne"), "Emirate Councils", 2),
  regular("west", "instituted-spies", "Instituted Spies", D.Smarbbit, ...zero(D.Smarbbit, "Smarbbit"), "Rigors of Agency", 2),
  regular("west", "social-corporatism", "Social Corporatism", D.Smarbbit, ...icons(D.Smarbbit, "Smarbbit"), "Balance of Power", 2),
  legacy("west", "declaration-of-universal-rights", "Declaration of Universal Rights"),
  legacy("west", "film-festival-de-internationale", "Film Festival de Internationale"),
];

/** TTS decks 12–16, in that order. Face = inactive side, back = active side. */
export const VICTORY_CARDS: VictoryCardDef[] = [
  victory("military", "Military", "Have 3+ more partisans than opponent does.", "Crown of the Vida Vesta"),
  victory("ideological", "Ideological", "Have more symbols in the ideology that has most total copies (at least 4).", "Police State of Brotherhood"),
  victory("popularity", "Popularity", "Lead by 9+ more support in a district.", "Republics of Eastern Vitali"),
  victory("cultural", "Cultural", "Have 2+ more monuments than opponent.", "Era of Vitalic Renaissance"),
  victory("diplomatic", "Diplomatic", "Have higher relationship with 3 of the 4 powers.", "Founder of the World Union"),
];

function victory(id: ExpansionVictoryId, name: string, text: string, title: string): VictoryCardDef {
  return {
    id,
    name,
    text,
    title,
    art: `/cards/expansion/victories/${id}.png`,
    inactiveArt: `/cards/expansion/victories/${id}-inactive.png`,
  };
}

/** Rulebook setup: from each power's 8 regular events, 3 are removed at random. */
export const EVENTS_REMOVED_PER_POWER = 3;
/** 4 × (8 − 3) regular + 8 legacy. */
export const EVENT_DECK_SIZE = 28;

const eventsById = new Map(EVENTS.map((event) => [event.id, event]));

export function getEvent(id: string): EventCard {
  const event = eventsById.get(id);
  if (!event) throw new Error(`Unknown event id: ${id}`);
  return event;
}

export function isEventId(id: string): boolean {
  return eventsById.has(id);
}
