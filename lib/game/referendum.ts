import { POLICIES } from "../cards/catalog.ts";
import { PolicySide, type DistrictId, type PolicyIdValue } from "../cards/schema.ts";
import { discardOwn, gameIsOver } from "./discard.ts";
import { afterMainAction } from "./income.ts";
import { printedDistrict, policySupportValue } from "./main.ts";
import { PLAYERS, type GameEvent, type GameState, type PlayerId } from "./types.ts";

export function printedPolicies(district: DistrictId) {
  const a = POLICIES.find(
    (policy) => policy.district === district && policy.side === PolicySide.A,
  );
  const b = POLICIES.find(
    (policy) => policy.district === district && policy.side === PolicySide.B,
  );
  if (!a || !b) {
    throw new Error(`Missing printed policies for ${district}`);
  }
  return { a, b };
}

/**
 * From a printed side: the other printed side, or Neutral.
 * From Neutral (no card): either printed side. Staying Neutral is not a change,
 * and "the other printed side" is undefined, so the winner picks A or B.
 */
export function referendumPolicyOptions(
  current: PolicyIdValue | null,
  district: DistrictId,
): Array<PolicyIdValue | null> {
  const { a, b } = printedPolicies(district);
  if (current === null) return [a.id, b.id];
  const other = current === a.id ? b.id : a.id;
  return [other, null];
}

export function startReferendum(state: GameState, events: GameEvent[]): void {
  state.referendum = {
    districtIndex: 0,
    awaitingChoice: false,
    chooser: state.activePlayer,
    options: [],
    support: [0, 0],
  };
  events.push({ type: "referendumStarted", player: state.activePlayer });
  continueReferendum(state, events);
}

export function continueReferendum(state: GameState, events: GameEvent[]): void {
  while (state.referendum && !gameIsOver(state)) {
    const district = state.districtOrder[state.referendum.districtIndex];
    if (!district) {
      finishReferendum(state, events);
      return;
    }

    const support = supportTotals(state, district);
    events.push({ type: "districtSupportRevealed", district, support });
    state.referendum.support = support;

    if (support[0] === support[1]) {
      events.push({ type: "policyUnchanged", district });
      discardDistrictSupporters(state, district, events);
      state.referendum.districtIndex += 1;
      continue;
    }

    const chooser: PlayerId = support[0] > support[1] ? 0 : 1;
    const options = referendumPolicyOptions(state.policy[district], district);
    state.referendum.awaitingChoice = true;
    state.referendum.chooser = chooser;
    state.referendum.options = options;
    events.push({ type: "policyChoiceNeeded", district, player: chooser });
    return;
  }
}

export function applyPolicyChoice(
  state: GameState,
  player: PlayerId,
  district: DistrictId,
  policyId: PolicyIdValue | null,
  events: GameEvent[],
): void {
  const pending = state.referendum;
  if (!pending?.awaitingChoice) {
    throw new Error("No policy choice is pending");
  }
  const current = state.districtOrder[pending.districtIndex];
  if (current !== district) {
    throw new Error(`Choice is for ${current}, not ${district}`);
  }
  if (player !== pending.chooser) {
    throw new Error("It is not this player's policy choice");
  }
  const allowed = pending.options.some((option) => option === policyId);
  if (!allowed) {
    throw new Error("That policy is not a legal referendum change");
  }

  state.policy[district] = policyId;
  events.push({ type: "policyChanged", district, policyId, player });
  discardDistrictSupporters(state, district, events);
  pending.awaitingChoice = false;
  pending.districtIndex += 1;
  continueReferendum(state, events);
}

function supportTotals(state: GameState, district: DistrictId): [number, number] {
  return PLAYERS.map((player) =>
    supportersIn(state, player, district).reduce(
      (sum, card) => sum + policySupportValue(card.cardId),
      0,
    ),
  ) as [number, number];
}

function supportersIn(state: GameState, player: PlayerId, district: DistrictId) {
  return state.players[player].policySupporters.filter(
    (card) => printedDistrict(card.cardId) === district,
  );
}

function discardDistrictSupporters(
  state: GameState,
  district: DistrictId,
  events: GameEvent[],
): void {
  for (const player of PLAYERS) {
    const seat = state.players[player];
    const kept: typeof seat.policySupporters = [];
    const revealed: typeof seat.policySupporters = [];
    for (const card of seat.policySupporters) {
      if (printedDistrict(card.cardId) === district) {
        revealed.push({ ...card, faceUp: true });
      } else {
        kept.push(card);
      }
    }
    seat.policySupporters = kept;
    if (revealed.length > 0) {
      discardOwn(state, player, revealed, events);
    }
  }
}

function finishReferendum(state: GameState, events: GameEvent[]): void {
  state.referendum = null;
  events.push({ type: "referendumEnded" });
  if (!gameIsOver(state)) {
    afterMainAction(state, events);
  }
}
