import { getCard } from "../cards/catalog.ts";
import { getEvent, isEventId, WORLD_POWER_NAME } from "../cards/expansion.ts";
import { CardKind, type DistrictId } from "../cards/schema.ts";
import { VictoryKind, type GameEvent, type PlayerId, type VictoryKindId } from "./types.ts";

export const ActionLogKind = {
  Play: "play",
  Recruit: "recruit",
  Construct: "construct",
  Senate: "senate",
  Proposal: "proposal",
  Market: "market",
  Party: "party",
  Election: "election",
  Decree: "decree",
  Discard: "discard",
  Victory: "victory",
  Ability: "ability",
} as const;
export type ActionLogKindId = (typeof ActionLogKind)[keyof typeof ActionLogKind];

export type ActionLogCard = {
  cardId: string;
  faceUp: boolean;
};

export type ActionLogEntry = {
  id: string;
  kind: ActionLogKindId;
  /** Who acted; `null` for table events (an election being revealed). */
  player: PlayerId | null;
  summary: string;
  primary: ActionLogCard | null;
  related: ActionLogCard[];
  relatedLabel?: string;
  district?: DistrictId;
};

const DISTRICT_LABEL: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

const VICTORY_LABEL: Record<VictoryKindId, string> = {
  [VictoryKind.Civil]: "Civil",
  [VictoryKind.Political]: "Political",
  [VictoryKind.Military]: "Military",
  [VictoryKind.Popularity]: "Popularity",
  [VictoryKind.Ideological]: "Ideological",
  [VictoryKind.Cultural]: "Cultural",
  [VictoryKind.Diplomatic]: "Diplomatic",
};

const EVENT_USE_LABEL = {
  effect: "for its effect",
  civil: "as a civil card",
  legacyDiscard: "to discard that power's events",
  legacyActivate: "to activate a victory",
} as const;

/** An event's own name (catalog names a regular event by its civil side). */
function eventName(cardId: string): string {
  return isEventId(cardId) ? getEvent(cardId).name : cardName(cardId);
}

type Draft = ActionLogEntry & {
  /** Discards that follow belong to this entry (a wipe, a cost, a pushed-out Senator). */
  absorb?: "wipe" | "cost" | "senate" | "proposal";
  /** Vote tally carried from a proposal to the policy change it causes. */
  votes?: string;
};

/**
 * Fold engine events into public history tiles. Only information both players
 * can see is shown: deck draws never name the card.
 */
export function buildActionLog(events: readonly GameEvent[], viewer: PlayerId): ActionLogEntry[] {
  const drafts: Draft[] = [];
  const last = (): Draft | undefined => drafts[drafts.length - 1];
  const push = (entry: Omit<Draft, "id">): Draft => {
    const draft: Draft = { ...entry, id: `${drafts.length}-${entry.kind}` };
    drafts.push(draft);
    return draft;
  };

  for (const event of events) {
    switch (event.type) {
      case "partyChosen":
        // Party picks stay secret until the reveal.
        break;
      case "partiesRevealed":
        for (const player of [0, 1] as const) {
          push({
            kind: ActionLogKind.Party,
            player,
            summary: `${who(player, viewer)} lead${player === viewer ? "" : "s"} the ${cardName(event.parties[player])}.`,
            primary: face(event.parties[player]),
            related: [],
          });
        }
        break;
      case "civilPlayed":
      case "alliancePlayed":
      case "conspiracyPlayed": {
        const label =
          event.type === "conspiracyPlayed" ? "conspiracy " : event.type === "alliancePlayed" ? "alliance " : "";
        push({
          kind: ActionLogKind.Play,
          player: event.player,
          summary: `${who(event.player, viewer)} played ${label}${cardName(event.cardId)} in ${DISTRICT_LABEL[event.district]}.`,
          primary: face(event.cardId),
          related: [],
          relatedLabel: event.type === "conspiracyPlayed" ? "Wiped" : undefined,
          district: event.district,
          absorb: event.type === "conspiracyPlayed" ? "wipe" : undefined,
        });
        break;
      }
      case "cardDiscarded": {
        const target = last();
        if (target?.absorb && target.player === event.player) {
          target.related.push(face(event.cardId));
          break;
        }
        // A discard with no owner yet: a recruit / construct cost arrives before its headline event.
        push({
          kind: ActionLogKind.Discard,
          player: event.player,
          summary: `${who(event.player, viewer)} discarded ${cardName(event.cardId)}.`,
          primary: face(event.cardId),
          related: [face(event.cardId)],
          relatedLabel: "Discarded",
          absorb: "cost",
        });
        break;
      }
      case "partisansRecruited": {
        const pending = last();
        const summary = `${who(event.player, viewer)} recruited a partisan (${event.count}).`;
        if (pending?.kind === ActionLogKind.Discard && pending.player === event.player) {
          pending.kind = ActionLogKind.Recruit;
          pending.summary = summary;
          pending.relatedLabel = "Spent";
          pending.absorb = undefined;
        } else {
          push({ kind: ActionLogKind.Recruit, player: event.player, summary, primary: null, related: [] });
        }
        break;
      }
      case "monumentConstructed":
        push({
          kind: ActionLogKind.Construct,
          player: event.player,
          summary: `${who(event.player, viewer)} constructed ${cardName(event.cardId)}.`,
          primary: face(event.cardId),
          related: [],
          relatedLabel: "Spent",
          absorb: "cost",
        });
        break;
      case "senateInfluenced":
        push({
          kind: ActionLogKind.Senate,
          player: event.player,
          summary: `${who(event.player, viewer)} seated ${cardName(event.seatedCardId)} in the Senate${
            event.removedCardId ? `, unseating ${cardName(event.removedCardId)}` : ""
          }.`,
          primary: face(event.seatedCardId),
          related: event.removedCardId ? [face(event.removedCardId)] : [],
          relatedLabel: "Unseated",
          absorb: "senate",
        });
        break;
      case "policyProposed":
        push({
          kind: ActionLogKind.Proposal,
          player: event.player,
          summary: `${who(event.player, viewer)} proposed a policy.`,
          votes: `${event.votes} of ${event.totalVotes} Senate votes`,
          primary: null,
          related: event.revealedCardIds.map(face),
          relatedLabel: "Revealed",
          absorb: "proposal",
        });
        break;
      case "policyChanged": {
        const proposal = last();
        const summary = event.policyId
          ? `${who(event.player, viewer)} set ${DISTRICT_LABEL[event.district]} to ${cardName(event.policyId)}.`
          : `${who(event.player, viewer)} set ${DISTRICT_LABEL[event.district]} to neutral.`;
        if (proposal?.kind === ActionLogKind.Proposal && proposal.player === event.player) {
          proposal.summary = `${summary.slice(0, -1)} with ${proposal.votes}.`;
          proposal.primary = event.policyId ? face(event.policyId) : null;
          proposal.district = event.district;
          proposal.absorb = undefined;
          break;
        }
        push({
          kind: ActionLogKind.Proposal,
          player: event.player,
          summary,
          primary: event.policyId ? face(event.policyId) : null,
          related: [],
          district: event.district,
        });
        break;
      }
      case "marketTaken":
        push({
          kind: ActionLogKind.Market,
          player: event.player,
          summary: `${who(event.player, viewer)} took ${cardName(event.cardId)} from the Market.`,
          primary: face(event.cardId),
          related: [],
        });
        break;
      case "electionSetAside": {
        const prior = last();
        if (prior?.kind === ActionLogKind.Election && prior.player === null) {
          prior.related.push(face(event.cardId));
          prior.summary = `${prior.related.length} General Elections revealed. The election grows.`;
          break;
        }
        push({
          kind: ActionLogKind.Election,
          player: null,
          summary: "A General Election was revealed. The Market grows to 8 and stops refilling.",
          primary: face(event.cardId),
          related: [face(event.cardId)],
          relatedLabel: "Revealed",
        });
        break;
      }
      case "electionWon":
        push({
          kind: ActionLogKind.Election,
          player: event.player,
          summary: `${who(event.player, viewer)} won the election (${event.wins} total).`,
          primary: null,
          related: [],
        });
        break;
      case "decreeActivated":
        push({
          kind: ActionLogKind.Decree,
          player: event.player,
          summary: `${who(event.player, viewer)} activated ${cardName(event.decreeId)}.`,
          primary: face(event.decreeId),
          related: [],
        });
        break;
      case "freeActionUsed":
        push({
          kind: ActionLogKind.Ability,
          player: event.player,
          summary: `${who(event.player, viewer)} used ${cardName(event.sourceCardId).replace(/\.$/, "")}.`,
          primary: face(event.sourceCardId),
          related: [],
          relatedLabel: "Spent",
          absorb: "cost",
        });
        break;
      case "cardsSetAside":
        push({
          kind: ActionLogKind.Ability,
          player: event.player,
          summary: `${who(event.player, viewer)} set aside ${event.cardIds.map(cardName).join(", ")} (${event.zone === "planetNextBank" ? "Planet Next" : "Consultative Office"}).`,
          primary: face(event.cardIds[0]!),
          related: event.cardIds.slice(1).map(face),
        });
        break;
      case "civilsSwapped":
        push({
          kind: ActionLogKind.Ability,
          player: event.player,
          summary: `${who(event.player, viewer)} swapped ${cardName(event.mineCardId)} for ${cardName(event.theirsCardId)} (Urban Aristocrats).`,
          primary: face(event.theirsCardId),
          related: [face(event.mineCardId)],
          relatedLabel: "Given away",
          district: "dragonara",
        });
        break;
      case "allianceReplaced":
        push({
          kind: ActionLogKind.Ability,
          player: event.player,
          summary: `${who(event.player, viewer)} replaced ${cardName(event.replacedCardId)} with ${cardName(event.cardId)} in ${DISTRICT_LABEL[event.district]}.`,
          primary: face(event.cardId),
          related: [face(event.replacedCardId)],
          relatedLabel: "Replaced",
          district: event.district,
        });
        break;
      case "cardRetrieved":
        push({
          kind: ActionLogKind.Ability,
          player: event.player,
          summary: `${who(event.player, viewer)} took ${cardName(event.cardId)} back from their ${DISTRICT_LABEL[event.district]} pile (People's Press).`,
          primary: face(event.cardId),
          related: [],
        });
        break;
      case "discardsRouted":
        push({
          kind: ActionLogKind.Ability,
          player: event.player,
          summary: `${who(event.player, viewer)} rerouted ${event.moves.length} discard${event.moves.length === 1 ? "" : "s"} (Space Agency).`,
          primary: face(event.moves[0]!.cardId),
          related: event.moves.slice(1).map((move) => face(move.cardId)),
        });
        break;
      case "eventBought":
        push({
          kind: ActionLogKind.Market,
          player: event.player,
          summary: `${who(event.player, viewer)} bought ${eventName(event.cardId)} ${EVENT_USE_LABEL[event.use]}${event.use === "civil" ? ` (${cardName(event.cardId)})` : ""}, paying ${event.cost}.`,
          primary: face(event.cardId),
          related: [],
          relatedLabel: "Paid",
          absorb: "cost",
        });
        break;
      case "relationGained":
        push({
          kind: ActionLogKind.Ability,
          player: event.player,
          summary: `${who(event.player, viewer)} gained a relation with ${WORLD_POWER_NAME[event.power]} (now ${event.relation}).`,
          primary: null,
          related: [],
        });
        break;
      case "victoryActivated":
        push({
          kind: ActionLogKind.Victory,
          player: event.player,
          summary: `${who(event.player, viewer)} activated ${VICTORY_LABEL[event.victory]} Victory.`,
          primary: null,
          related: [],
        });
        break;
      case "eventsRemoved":
        push({
          kind: ActionLogKind.Discard,
          player: null,
          summary: `${event.cardIds.map(eventName).join(", ")} left the game.`,
          primary: face(event.cardIds[0]!),
          related: event.cardIds.slice(1).map(face),
        });
        break;
      case "victory":
        push({
          kind: ActionLogKind.Victory,
          player: event.victory.player,
          summary: `${who(event.victory.player, viewer)} won by ${VICTORY_LABEL[event.victory.kind]} Victory.`,
          primary: null,
          related: [],
          district: event.victory.district,
        });
        break;
      default:
        break;
    }
  }

  return drafts.map((draft) => ({
    id: draft.id,
    kind: draft.kind,
    player: draft.player,
    summary: draft.summary,
    primary: draft.primary,
    related: draft.related,
    relatedLabel: draft.relatedLabel,
    district: draft.district,
  }));
}

/** Which card back to show for a face-down log card. */
export function logCardBack(cardId: string): "common" | "monument" | "party" {
  try {
    const kind = getCard(cardId).kind;
    if (kind === CardKind.Monument) return "monument";
    if (kind === CardKind.Party) return "party";
  } catch {
    return "common";
  }
  return "common";
}

function face(cardId: string): ActionLogCard {
  return { cardId, faceUp: true };
}

function who(player: PlayerId, viewer: PlayerId): string {
  return player === viewer ? "You" : `Player ${player + 1}`;
}

function cardName(cardId: string): string {
  try {
    return getCard(cardId).name;
  } catch {
    return cardId;
  }
}
