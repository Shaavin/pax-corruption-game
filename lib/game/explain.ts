import { getCard } from "../cards/catalog.ts";
import { CardKind, District, PolicyId, type DistrictId } from "../cards/schema.ts";
import { allianceLimit, policyActive } from "./abilities.ts";
import { allianceCount, canPlayAlliance, handLikeCards } from "./main.ts";
import { playBlockReason } from "./plays.ts";
import { Phase, type GameState, type PlayerId } from "./types.ts";

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

/**
 * Why a card in `player`'s hand can't be played to the table in the Action step,
 * in plain words; null when it can. (Mirrors `mainActions`.)
 */
export function handCardBlockReason(state: GameState, player: PlayerId, instanceId: string): string | null {
  if (state.phase !== Phase.Action) return null;
  const card = handLikeCards(state, player, { market: true }).find((entry) => entry.instanceId === instanceId);
  if (!card) return null;
  const def = getCard(card.cardId);
  if (def.kind !== CardKind.Civil && def.kind !== CardKind.Alliance && def.kind !== CardKind.Conspiracy) {
    return "This card isn't played to the table.";
  }
  if (state.turn.mainActionDone) {
    return "You've already taken your main action this turn. Use a free action, or end the action step.";
  }
  const blocked = playBlockReason(state, card.cardId);
  if (blocked) return `${blocked}.`;
  if (def.kind === CardKind.Civil) return null;
  if (state.market.includes(card)) return "Only civil cards can be played straight from the Market.";
  if (def.kind === CardKind.Alliance && !canPlayAlliance(state, player, def.district)) {
    const limit = allianceLimit(state, player, def.district);
    const name = DISTRICT_NAME[def.district];
    if (limit === 0) return `Martial Law: no alliances can be played in ${name}.`;
    const martial = def.district === District.Shavvinne && policyActive(state, PolicyId.ShavvinneA);
    const have = allianceCount(state, player, def.district);
    return `You already have ${have} ${have === 1 ? "alliance" : "alliances"} in ${name}, the most you can have there${martial ? " under Martial Law" : ""}.`;
  }
  return null;
}
