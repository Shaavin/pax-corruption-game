"use client";

import { useEffect, useMemo, useState } from "react";
import { GameOverOverlay } from "./GameOverOverlay";
import { PassDeviceGate } from "./PassDeviceGate";
import { playerLabel } from "./players";
import { PolicyChoice } from "./PolicyChoice";
import { SetupOverlay } from "./SetupOverlay";
import { Table, type ExtraAction } from "./Table";
import { tableModel } from "./table-model";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, type DistrictId } from "@/lib/cards/schema";
import {
  apply,
  CONSTRUCT_COST,
  createGame,
  createSeededRng,
  currentActor,
  FLAG_CAMPAIGNED,
  legalActions,
  otherPlayer,
  Phase,
  playTargetDistrict,
  printedDistrict,
  recruitBlockReason,
  constructBlockReason,
  referendumBlockReason,
  RECRUIT_COST,
  REFERENDUM_COST,
  REFERENDUM_SUPPORTER_MIN,
  SetupStep,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Rng,
} from "@/lib/game";

type Session = {
  seed: number;
  rng: Rng;
  state: GameState;
  lastEvents: GameEvent[];
};

type SpendKind = "recruit" | "construct" | "referendum";

const START_OF_TURN = new Set<Action["type"]>([
  "playCivil",
  "playAlliance",
  "playConspiracy",
  "recruit",
  "construct",
  "callReferendum",
  "endAction",
]);

export function HotseatSession({ seed }: { seed: number }) {
  const [session, setSession] = useState<Session>(() => startSession(seed));
  const [seated, setSeated] = useState<PlayerId | null>(null);
  const [selectedHandIds, setSelectedHandIds] = useState<string[]>([]);
  const [spendKind, setSpendKind] = useState<SpendKind | null>(null);

  const { state } = session;
  const actor = currentActor(state);
  const veiled = seated !== null && seated !== actor && !state.victory;
  const waitingFirstSeat = seated === null;
  const viewer: PlayerId = seated ?? 0;
  const model = useMemo(() => tableModel(state, viewer), [state, viewer]);
  const inSetup = state.phase === Phase.Setup;
  const legal = useMemo(
    () => (veiled || waitingFirstSeat ? [] : legalActions(state, viewer)),
    [state, veiled, waitingFirstSeat, viewer],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedHandIds([]);
      setSpendKind(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function dispatch(action: Action) {
    const result = apply(session.state, action, session.rng);
    setSelectedHandIds([]);
    setSpendKind(null);
    setSession({
      ...session,
      state: result.state,
      lastEvents: START_OF_TURN.has(action.type)
        ? result.events
        : [...session.lastEvents, ...result.events],
    });
  }

  const playableHandIds = useMemo(() => {
    const ids = new Set<string>();
    for (const action of legal) {
      if (
        action.type === "playCivil" ||
        action.type === "playAlliance" ||
        action.type === "playConspiracy" ||
        action.type === "campaign"
      ) {
        ids.add(action.instanceId);
      }
    }
    return ids;
  }, [legal]);

  const takeableMarketIds = useMemo(() => {
    const ids = new Set<string>();
    for (const action of legal) {
      if (action.type === "takeMarket") ids.add(action.instanceId);
    }
    return ids;
  }, [legal]);

  const hand = state.players[viewer].hand;
  const spendCost =
    spendKind === "recruit"
      ? RECRUIT_COST
      : spendKind === "construct"
        ? CONSTRUCT_COST
        : spendKind === "referendum"
          ? REFERENDUM_COST
          : 0;
  const selectedDistrict = districtOfSelection(hand, selectedHandIds);
  const spendReady =
    spendKind !== null &&
    selectedHandIds.length === spendCost &&
    selectedDistrict !== null;

  const selectableHandIds = useMemo(() => {
    if (spendKind) {
      return spendSelectable(hand, selectedHandIds, spendCost);
    }
    if (state.phase === Phase.Politics) return playableHandIds;
    if (state.phase === Phase.Action) return playableHandIds;
    return new Set<string>();
  }, [spendKind, hand, selectedHandIds, spendCost, state.phase, playableHandIds]);

  const selectedCard = selectedHandIds.length === 1 ? hand.find((card) => card.instanceId === selectedHandIds[0]) : undefined;
  const playDistrict =
    !spendKind &&
    state.phase === Phase.Action &&
    selectedCard
      ? playTargetDistrict(state, viewer, selectedCard.instanceId)
      : null;
  const targetLabel =
    selectedCard && getCard(selectedCard.cardId).kind === CardKind.Conspiracy
      ? "Wipe this district"
      : "Play here";

  const claimableMonumentIds = useMemo(() => {
    const ids = new Set<string>();
    if (spendKind !== "construct" || !spendReady || !selectedDistrict) return ids;
    for (const action of legal) {
      if (
        action.type === "construct" &&
        action.monumentInstanceId &&
        sameIds(action.instanceIds, selectedHandIds)
      ) {
        ids.add(action.monumentInstanceId);
      }
    }
    return ids;
  }, [spendKind, spendReady, selectedDistrict, legal, selectedHandIds]);

  const canEndAction = legal.some((action) => action.type === "endAction");
  const recruitReason = recruitBlockReason(state, viewer);
  const constructReason = constructBlockReason(state, viewer);
  const referendumReason = referendumBlockReason(state, viewer);
  const campaignArmed =
    state.phase === Phase.Politics &&
    !state.flags[FLAG_CAMPAIGNED] &&
    selectedHandIds.length === 1 &&
    playableHandIds.has(selectedHandIds[0]!);

  const extraActions: ExtraAction[] = [];
  if (spendKind) {
    extraActions.push({
      label: "Cancel",
      onClick: () => {
        setSpendKind(null);
        setSelectedHandIds([]);
      },
    });
    if (spendKind !== "construct" && spendReady) {
      extraActions.push({
        label: spendKind === "recruit" ? "Recruit" : "Call referendum",
        onClick: () => {
          if (spendKind === "recruit") {
            dispatch({ type: "recruit", player: viewer, instanceIds: selectedHandIds });
          } else {
            dispatch({
              type: "callReferendum",
              player: viewer,
              instanceIds: selectedHandIds,
            });
          }
        },
      });
    }
  } else if (state.phase === Phase.Action && !state.referendum) {
    extraActions.push({
      label: "Recruit",
      disabled: recruitReason !== null,
      title: recruitReason ?? "Discard 3 cards of the same district",
      onClick: () => {
        setSpendKind("recruit");
        setSelectedHandIds([]);
      },
    });
    extraActions.push({
      label: "Construct",
      disabled: constructReason !== null,
      title: constructReason ?? "Discard 5 cards of the same district to claim a monument",
      onClick: () => {
        setSpendKind("construct");
        setSelectedHandIds([]);
      },
    });
    extraActions.push({
      label:
        state.players[viewer].policySupporters.length < REFERENDUM_SUPPORTER_MIN
          ? `Call referendum · ${state.players[viewer].policySupporters.length}/${REFERENDUM_SUPPORTER_MIN}`
          : "Call referendum",
      disabled: referendumReason !== null,
      title: referendumReason ?? "Discard 2 cards of the same district, then resolve policies",
      onClick: () => {
        setSpendKind("referendum");
        setSelectedHandIds([]);
      },
    });
    if (canEndAction) {
      extraActions.push({
        label: "No main action — continue",
        onClick: () => dispatch({ type: "endAction", player: viewer }),
      });
    }
  } else if (state.phase === Phase.Politics) {
    if (campaignArmed) {
      extraActions.push({
        label: "Tuck as campaign",
        onClick: () => {
          const id = selectedHandIds[0];
          if (!id) return;
          dispatch({ type: "campaign", player: viewer, instanceId: id });
        },
      });
    }
    extraActions.push({
      label: "Skip politics",
      onClick: () => dispatch({ type: "endPolitics", player: viewer }),
    });
  }

  const pendingReferendum = state.referendum?.awaitingChoice ? state.referendum : null;
  const pendingDistrict = pendingReferendum
    ? state.districtOrder[pendingReferendum.districtIndex]
    : undefined;

  const interaction =
    veiled || waitingFirstSeat || inSetup || state.victory || pendingReferendum
      ? null
      : {
          playableHandIds: spendKind ? selectableHandIds : playableHandIds,
          selectableHandIds:
            spendKind ||
            state.phase === Phase.Action ||
            state.phase === Phase.Politics
              ? selectableHandIds
              : undefined,
          selectedHandIds: new Set(selectedHandIds),
          onSelectHand: (instanceId: string) => {
            if (spendKind) {
              setSelectedHandIds((current) =>
                toggleSpend(hand, current, instanceId, spendCost),
              );
              return;
            }
            setSelectedHandIds((current) =>
              current.length === 1 && current[0] === instanceId ? [] : [instanceId],
            );
          },
          targetDistrict: playDistrict,
          targetLabel,
          onSelectDistrict: (district: DistrictId) => {
            if (state.phase !== Phase.Action) return;
            if (!selectedCard || playDistrict !== district) return;
            const kind = getCard(selectedCard.cardId).kind;
            if (kind === CardKind.Civil) {
              dispatch({ type: "playCivil", player: viewer, instanceId: selectedCard.instanceId });
            } else if (kind === CardKind.Alliance) {
              dispatch({
                type: "playAlliance",
                player: viewer,
                instanceId: selectedCard.instanceId,
              });
            } else if (kind === CardKind.Conspiracy) {
              dispatch({
                type: "playConspiracy",
                player: viewer,
                instanceId: selectedCard.instanceId,
              });
            }
          },
          takeableMarketIds,
          onTakeMarket: (instanceId: string) => {
            dispatch({ type: "takeMarket", player: viewer, instanceId });
          },
          claimableMonumentIds,
          onClaimMonument: (instanceId: string) => {
            dispatch({
              type: "construct",
              player: viewer,
              instanceIds: selectedHandIds,
              monumentInstanceId: instanceId,
            });
          },
          campaignArmed,
          onCampaign: () => {
            const id = selectedHandIds[0];
            if (!id) return;
            dispatch({ type: "campaign", player: viewer, instanceId: id });
          },
          prompt: turnPrompt(state, {
            spendKind,
            selectedCount: selectedHandIds.length,
            spendCost,
            spendReady,
            playDistrict,
            canEndAction,
            campaignArmed,
          }),
          extraActions,
        };

  const showGate = (waitingFirstSeat || veiled) && !state.victory;

  return (
    <Table
      model={model}
      seed={session.seed}
      status={statusLine(state)}
      showTour={!veiled && !waitingFirstSeat && !inSetup && !state.victory}
      veiled={veiled || waitingFirstSeat}
      hotseat={viewer}
      interaction={interaction}
    >
      {veiled || waitingFirstSeat ? null : (
        <SetupOverlay state={state} viewer={viewer} onAction={dispatch} />
      )}
      {pendingDistrict && pendingReferendum && !veiled && !waitingFirstSeat ? (
        <PolicyChoice
          district={pendingDistrict}
          support={pendingReferendum.support}
          chooserIsYou={viewer === pendingReferendum.chooser}
          options={pendingReferendum.options}
          onChoose={({ district, policyId }) =>
            dispatch({
              type: "choosePolicy",
              player: viewer,
              district,
              policyId,
            })
          }
        />
      ) : null}
      {state.victory ? <GameOverOverlay victory={state.victory} /> : null}
      {showGate ? (
        <PassDeviceGate
          to={actor}
          firstHandoff={waitingFirstSeat}
          hint={gateHint(state, session.lastEvents)}
          onConfirm={() => setSeated(actor)}
        />
      ) : null}
    </Table>
  );
}

function startSession(seed: number): Session {
  const rng = createSeededRng(seed);
  return { seed, rng, state: createGame(rng, { seed }), lastEvents: [] };
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((id) => other.has(id));
}

function districtOfSelection(
  hand: { instanceId: string; cardId: string }[],
  ids: readonly string[],
): DistrictId | null {
  if (ids.length === 0) return null;
  const districts = ids.map((id) => {
    const card = hand.find((entry) => entry.instanceId === id);
    return card ? printedDistrict(card.cardId) : null;
  });
  const first = districts[0];
  if (!first || districts.some((district) => district !== first)) return null;
  return first;
}

function spendSelectable(
  hand: { instanceId: string; cardId: string }[],
  selected: readonly string[],
  cost: number,
): Set<string> {
  const selectedDistrict = districtOfSelection(hand, selected);
  const ids = new Set<string>();
  for (const card of hand) {
    const def = getCard(card.cardId);
    if (def.kind === CardKind.Election) continue;
    const district = printedDistrict(card.cardId);
    if (selectedDistrict && district !== selectedDistrict) continue;
    if (!selected.includes(card.instanceId) && selected.length >= cost) continue;
    const inDistrict = hand.filter((entry) => printedDistrict(entry.cardId) === district);
    if (inDistrict.length >= cost) ids.add(card.instanceId);
  }
  return ids;
}

function toggleSpend(
  hand: { instanceId: string; cardId: string }[],
  current: string[],
  instanceId: string,
  cost: number,
): string[] {
  if (current.includes(instanceId)) {
    return current.filter((id) => id !== instanceId);
  }
  const card = hand.find((entry) => entry.instanceId === instanceId);
  if (!card) return current;
  const district = printedDistrict(card.cardId);
  const currentDistrict = districtOfSelection(hand, current);
  const base = currentDistrict && currentDistrict !== district ? [] : current;
  if (base.length >= cost) return base;
  return [...base, instanceId];
}

function turnPrompt(
  state: GameState,
  opts: {
    spendKind: SpendKind | null;
    selectedCount: number;
    spendCost: number;
    spendReady: boolean;
    playDistrict: DistrictId | null;
    canEndAction: boolean;
    campaignArmed: boolean;
  },
): string {
  if (state.phase === Phase.Income) {
    return "Income · take one market card";
  }
  if (state.phase === Phase.Politics) {
    if (opts.campaignArmed) {
      return "Politics · tuck onto your supporters pile, or Tuck as campaign";
    }
    return "Politics · tuck one card as a campaign, or skip";
  }
  if (opts.spendKind === "recruit") {
    return opts.spendReady
      ? "Recruit · confirm 3 cards of the same district"
      : `Recruit · select ${opts.spendCost} cards of the same district (${opts.selectedCount}/${opts.spendCost})`;
  }
  if (opts.spendKind === "construct") {
    return opts.spendReady
      ? "Construct · choose a matching monument"
      : `Construct · select ${opts.spendCost} cards of the same district (${opts.selectedCount}/${opts.spendCost})`;
  }
  if (opts.spendKind === "referendum") {
    return opts.spendReady
      ? "Referendum · confirm 2 cards of the same district"
      : `Referendum · select ${opts.spendCost} cards of the same district (${opts.selectedCount}/${opts.spendCost})`;
  }
  if (opts.canEndAction) {
    return "Action · no legal main action";
  }
  if (opts.playDistrict) {
    return "Action · play into the highlighted district";
  }
  return "Action · play a card, or choose recruit / construct / referendum";
}

function statusLine(state: GameState): string {
  if (state.victory) return "Game over";
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseParty) {
    return "Setup · choose party";
  }
  if (
    state.phase === Phase.Setup &&
    state.setup?.step === SetupStep.ChooseStartingHand
  ) {
    return "Setup · starting cards";
  }
  if (state.referendum?.awaitingChoice) {
    return "Referendum · choose policy";
  }
  if (state.phase === Phase.Action) return "Action · your turn";
  if (state.phase === Phase.Politics) return "Politics";
  if (state.phase === Phase.Income) return "Income · take a market card";
  return state.phase;
}

function gateHint(state: GameState, events: GameEvent[]): string {
  if (state.referendum?.awaitingChoice) {
    return `${playerLabel(state.referendum.chooser)} chooses the new district policy. Hands stay hidden.`;
  }
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseParty) {
    return state.activePlayer === 0
      ? "Choose one of the two parties dealt to you, then your starting cards."
      : "Choose one of the two parties dealt to you. You get all 4 listed starting cards.";
  }
  if (
    state.phase === Phase.Setup &&
    state.setup?.step === SetupStep.ChooseStartingHand
  ) {
    return `${playerLabel(state.activePlayer)} takes 3 of 4 starting cards. ${playerLabel(otherPlayer(state.activePlayer))} gets all 4.`;
  }

  const bits: string[] = [];
  for (const event of events) {
    if (event.type === "civilPlayed") bits.push(`Played ${getCard(event.cardId).name}.`);
    if (event.type === "alliancePlayed") bits.push(`Played alliance ${getCard(event.cardId).name}.`);
    if (event.type === "conspiracyPlayed") bits.push(`Played conspiracy ${getCard(event.cardId).name}.`);
    if (event.type === "partisansRecruited") bits.push("Recruited a partisan.");
    if (event.type === "monumentConstructed") bits.push(`Constructed ${getCard(event.cardId).name}.`);
    if (event.type === "campaignTucked") bits.push("Tucked a policy supporter.");
    if (event.type === "policyChanged") {
      bits.push(
        event.policyId
          ? `Set policy to ${getCard(event.policyId).name}.`
          : "Set a district to Neutral.",
      );
    }
    if (event.type === "marketTaken") bits.push(`Took ${getCard(event.cardId).name} from the market.`);
    if (event.type === "cardDrawn") bits.push("Drew from the deck.");
    if (event.type === "electionSetAside") bits.push("A general election was set aside.");
  }
  bits.push("Your turn is over. Pass the device.");
  return bits.join(" ");
}
