"use client";

import { useEffect, useMemo, useState } from "react";
import { DecreeChoice } from "./DecreeChoice";
import { GameOverOverlay } from "./GameOverOverlay";
import { PassDeviceGate } from "./PassDeviceGate";
import { playerLabel } from "./players";
import { SetupOverlay } from "./SetupOverlay";
import { Table, type ExtraAction } from "./Table";
import { tableModel } from "./table-model";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, type DistrictId, type PolicyIdValue } from "@/lib/cards/schema";
import {
  apply,
  CONSTRUCT_COST,
  convincedSenators,
  convincedVotes,
  createGame,
  createSeededRng,
  currentActor,
  declarableVictories,
  inactiveDecrees,
  legalActions,
  otherPlayer,
  Phase,
  playTargetDistrict,
  policyTargets,
  printedDistrict,
  recruitBlockReason,
  constructBlockReason,
  revealPasses,
  RECRUIT_COST,
  SetupStep,
  VictoryKind,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Rng,
  type Victory,
} from "@/lib/game";

type Session = {
  seed: number;
  rng: Rng;
  state: GameState;
  lastEvents: GameEvent[];
};

type SpendKind = "recruit" | "construct" | "propose";

type PolicyTarget = { district: DistrictId; policyId: PolicyIdValue | null };

const START_OF_TURN = new Set<Action["type"]>([
  "playCivil",
  "playAlliance",
  "playConspiracy",
  "recruit",
  "construct",
  "endAction",
]);

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

export function HotseatSession({ seed }: { seed: number }) {
  const [session, setSession] = useState<Session>(() => startSession(seed));
  const [seated, setSeated] = useState<PlayerId | null>(null);
  const [selectedHandIds, setSelectedHandIds] = useState<string[]>([]);
  const [spendKind, setSpendKind] = useState<SpendKind | null>(null);
  const [proposeTarget, setProposeTarget] = useState<PolicyTarget | null>(null);

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

  function resetSelection() {
    setSelectedHandIds([]);
    setSpendKind(null);
    setProposeTarget(null);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedHandIds([]);
      setSpendKind(null);
      setProposeTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function dispatch(action: Action) {
    const result = apply(session.state, action, session.rng);
    resetSelection();
    setSession({
      ...session,
      state: result.state,
      lastEvents: START_OF_TURN.has(action.type)
        ? result.events
        : [...session.lastEvents, ...result.events],
    });
  }

  const hand = state.players[viewer].hand;
  const inPolitics = state.phase === Phase.Politics;
  const inAction = state.phase === Phase.Action;

  const playableHandIds = useMemo(() => {
    const ids = new Set<string>();
    for (const action of legal) {
      if (
        action.type === "playCivil" ||
        action.type === "playAlliance" ||
        action.type === "playConspiracy" ||
        action.type === "influenceSenate"
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

  // --- Spending (recruit / construct) ---------------------------------------------
  const spendCost =
    spendKind === "recruit" ? RECRUIT_COST : spendKind === "construct" ? CONSTRUCT_COST : 0;
  const selectedDistrict = districtOfSelection(hand, selectedHandIds);
  const spendReady =
    (spendKind === "recruit" || spendKind === "construct") &&
    selectedHandIds.length === spendCost &&
    selectedDistrict !== null;

  // --- Propose Policy ----------------------------------------------------------------
  const revealedCardIds = selectedHandIds
    .map((id) => hand.find((card) => card.instanceId === id)?.cardId)
    .filter((id): id is string => Boolean(id));
  const proposing = spendKind === "propose";
  const revealPassing = proposing && revealedCardIds.length > 0 && revealPasses(state, revealedCardIds);
  const convinced = proposing ? new Set(convincedSenators(state, revealedCardIds)) : undefined;
  const revealVotes = proposing ? convincedVotes(state, revealedCardIds) : null;
  const wholeHandPasses = hand.length > 0 && revealPasses(state, hand.map((card) => card.cardId));

  const selectableHandIds = useMemo(() => {
    if (spendKind === "recruit" || spendKind === "construct") {
      return spendSelectable(hand, selectedHandIds, spendCost);
    }
    if (spendKind === "propose") {
      return proposeTarget ? new Set(selectedHandIds) : new Set(hand.map((card) => card.instanceId));
    }
    if (inPolitics || inAction) return playableHandIds;
    return new Set<string>();
  }, [spendKind, hand, selectedHandIds, spendCost, proposeTarget, inPolitics, inAction, playableHandIds]);

  const selectedCard =
    selectedHandIds.length === 1 ? hand.find((card) => card.instanceId === selectedHandIds[0]) : undefined;
  const playDistrict =
    !spendKind && inAction && selectedCard
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
      if (action.type === "construct" && sameIds(action.instanceIds, selectedHandIds)) {
        ids.add(action.monumentInstanceId);
      }
    }
    return ids;
  }, [spendKind, spendReady, selectedDistrict, legal, selectedHandIds]);

  const canEndAction = legal.some((action) => action.type === "endAction");
  const recruitReason = recruitBlockReason(state, viewer);
  const constructReason = constructBlockReason(state, viewer);
  const declarable = inPolitics ? declarableVictories(state, viewer) : [];
  const seatArmed = inPolitics && !spendKind && selectedCard !== undefined;

  const extraActions: ExtraAction[] = [];
  if (spendKind) {
    extraActions.push({ label: "Cancel", onClick: resetSelection });
    if (spendKind === "recruit" && spendReady) {
      extraActions.push({
        label: "Recruit",
        onClick: () => dispatch({ type: "recruit", player: viewer, instanceIds: selectedHandIds }),
      });
    }
    if (spendKind === "propose" && revealPassing && !proposeTarget) {
      for (const target of policyTargets(state, revealedCardIds)) {
        extraActions.push({
          label: `${DISTRICT_NAME[target.district]} → ${policyName(target.policyId)}`,
          title: "Change this district's policy, then pick a revealed card to discard",
          onClick: () => setProposeTarget(target),
        });
      }
    }
  } else if (inAction) {
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
    if (canEndAction) {
      extraActions.push({
        label: "No main action — continue",
        onClick: () => dispatch({ type: "endAction", player: viewer }),
      });
    }
  } else if (inPolitics) {
    if (seatArmed) {
      extraActions.push({
        label: "Seat in the Senate",
        title: "The rightmost Senator is discarded to your support pile",
        onClick: () =>
          dispatch({ type: "influenceSenate", player: viewer, instanceId: selectedCard.instanceId }),
      });
    }
    extraActions.push({
      label: "Propose policy",
      disabled: !wholeHandPasses,
      title: wholeHandPasses
        ? "Reveal cards that convince more than half of the Senate"
        : "Your hand can't convince more than half of the Senate",
      onClick: () => {
        setSpendKind("propose");
        setSelectedHandIds([]);
      },
    });
    for (const victory of declarable) {
      extraActions.push({
        label: `Declare ${victoryLabel(victory)}`,
        onClick: () => dispatch({ type: "declareVictory", player: viewer, victory }),
      });
    }
    extraActions.push({
      label: "Skip politics",
      onClick: () => dispatch({ type: "endPolitics", player: viewer }),
    });
  }

  const pendingDecrees = state.phase === Phase.DecreeChoice ? state.pendingDecrees : null;

  const interaction =
    veiled || waitingFirstSeat || inSetup || state.victory || pendingDecrees
      ? null
      : {
          playableHandIds: spendKind ? selectableHandIds : playableHandIds,
          selectableHandIds: spendKind || inAction || inPolitics ? selectableHandIds : undefined,
          selectedHandIds: new Set(selectedHandIds),
          onSelectHand: (instanceId: string) => {
            if (spendKind === "propose") {
              if (proposeTarget) {
                if (!selectedHandIds.includes(instanceId)) return;
                dispatch({
                  type: "proposePolicy",
                  player: viewer,
                  revealIds: selectedHandIds,
                  discardId: instanceId,
                  district: proposeTarget.district,
                  policyId: proposeTarget.policyId,
                });
                return;
              }
              setSelectedHandIds((current) =>
                current.includes(instanceId)
                  ? current.filter((id) => id !== instanceId)
                  : [...current, instanceId],
              );
              return;
            }
            if (spendKind) {
              setSelectedHandIds((current) => toggleSpend(hand, current, instanceId, spendCost));
              return;
            }
            setSelectedHandIds((current) =>
              current.length === 1 && current[0] === instanceId ? [] : [instanceId],
            );
          },
          targetDistrict: playDistrict,
          targetLabel,
          onSelectDistrict: (district: DistrictId) => {
            if (!inAction || !selectedCard || playDistrict !== district) return;
            const kind = getCard(selectedCard.cardId).kind;
            const instanceId = selectedCard.instanceId;
            if (kind === CardKind.Civil) dispatch({ type: "playCivil", player: viewer, instanceId });
            else if (kind === CardKind.Alliance) dispatch({ type: "playAlliance", player: viewer, instanceId });
            else if (kind === CardKind.Conspiracy) dispatch({ type: "playConspiracy", player: viewer, instanceId });
          },
          takeableMarketIds,
          onTakeMarket: (instanceId: string) => dispatch({ type: "takeMarket", player: viewer, instanceId }),
          claimableMonumentIds,
          onClaimMonument: (instanceId: string) =>
            dispatch({
              type: "construct",
              player: viewer,
              instanceIds: selectedHandIds,
              monumentInstanceId: instanceId,
            }),
          convincedSenators: convinced,
          revealVotes,
          prompt: turnPrompt(state, {
            spendKind,
            selectedCount: selectedHandIds.length,
            spendCost,
            spendReady,
            playDistrict,
            canEndAction,
            seatArmed,
            revealPassing,
            proposeTarget,
            declarable: declarable.length,
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
      {pendingDecrees && !veiled && !waitingFirstSeat ? (
        <DecreeChoice
          winner={pendingDecrees.player}
          chooserIsYou={viewer === pendingDecrees.player}
          remaining={pendingDecrees.remaining}
          options={inactiveDecrees(state)}
          onChoose={(decreeId) => dispatch({ type: "activateDecree", player: viewer, decreeId })}
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

function policyName(policyId: PolicyIdValue | null): string {
  return policyId ? getCard(policyId).name : "Neutral";
}

function victoryLabel(victory: Victory): string {
  switch (victory.kind) {
    case VictoryKind.Civil:
      return "Civil Victory";
    case VictoryKind.Political:
      return "Political Victory";
    case VictoryKind.Military:
      return "Military Victory";
    case VictoryKind.Popularity:
      return `Popularity Victory${victory.district ? ` (${DISTRICT_NAME[victory.district]})` : ""}`;
    case VictoryKind.Ideological:
      return `Ideological Victory${victory.symbol ? ` (${victory.symbol})` : ""}`;
  }
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
    seatArmed: boolean;
    revealPassing: boolean;
    proposeTarget: PolicyTarget | null;
    declarable: number;
  },
): string {
  const election = state.election.active ? "Election · " : "";
  if (state.phase === Phase.Income) {
    return state.election.active
      ? "Election income · take one market card (the market does not refill)"
      : "Income · take one market card";
  }
  if (opts.spendKind === "propose") {
    if (opts.proposeTarget) {
      return `Propose · click one revealed card to discard (sets ${DISTRICT_NAME[opts.proposeTarget.district]} to ${policyName(opts.proposeTarget.policyId)})`;
    }
    if (opts.revealPassing) return "Propose · majority convinced. Choose the policy change";
    return opts.selectedCount === 0
      ? "Propose · select cards to reveal: a higher civil of a Senator's district, or an alliance of its district"
      : "Propose · reveal more cards to convince more than half of the votes";
  }
  if (state.phase === Phase.Politics) {
    if (opts.seatArmed) return "Politics · seat the selected card in the Senate, or pick another";
    const declare = opts.declarable > 0 ? ", declare a victory" : "";
    return `${election}Politics · select a card to seat in the Senate, propose a policy${declare}, or skip`;
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
  if (opts.canEndAction) return `${election}Action · no legal main action`;
  if (opts.playDistrict) return `${election}Action · play into the highlighted district`;
  return `${election}Action · play a card, or choose recruit / construct`;
}

function statusLine(state: GameState): string {
  if (state.victory) return "Game over";
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseParty) {
    return "Setup · choose party";
  }
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseStartingHand) {
    return "Setup · starting cards";
  }
  if (state.phase === Phase.DecreeChoice) return "Election · winner activates decrees";
  const prefix = state.election.active ? "Election · " : "";
  if (state.phase === Phase.Action) return `${prefix}Action · your turn`;
  if (state.phase === Phase.Politics) return `${prefix}Politics`;
  if (state.phase === Phase.Income) return `${prefix}Income · take a market card`;
  return state.phase;
}

function gateHint(state: GameState, events: GameEvent[]): string {
  if (state.phase === Phase.DecreeChoice && state.pendingDecrees) {
    return `${playerLabel(state.pendingDecrees.player)} won the election and activates ${state.pendingDecrees.remaining === 1 ? "a decree" : `${state.pendingDecrees.remaining} decrees`}.`;
  }
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseParty) {
    return state.activePlayer === 0
      ? "Choose one of the two parties dealt to you, then your starting cards."
      : "Choose one of the two parties dealt to you. You get all 4 listed starting cards.";
  }
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseStartingHand) {
    return `${playerLabel(state.activePlayer)} takes 3 of 4 starting cards. ${playerLabel(otherPlayer(state.activePlayer))} gets all 4.`;
  }

  const bits: string[] = [];
  for (const event of events) {
    if (event.type === "civilPlayed") bits.push(`Played ${getCard(event.cardId).name}.`);
    if (event.type === "alliancePlayed") bits.push(`Played alliance ${getCard(event.cardId).name}.`);
    if (event.type === "conspiracyPlayed") bits.push(`Played conspiracy ${getCard(event.cardId).name}.`);
    if (event.type === "partisansRecruited") bits.push("Recruited a partisan.");
    if (event.type === "monumentConstructed") bits.push(`Constructed ${getCard(event.cardId).name}.`);
    if (event.type === "senateInfluenced") {
      bits.push(`Seated ${getCard(event.seatedCardId).name} in the Senate.`);
    }
    if (event.type === "policyProposed") bits.push("Proposed a policy.");
    if (event.type === "policyChanged") bits.push(`Set ${DISTRICT_NAME[event.district]} to ${policyName(event.policyId)}.`);
    if (event.type === "marketTaken") bits.push(`Took ${getCard(event.cardId).name} from the market.`);
    if (event.type === "cardDrawn") bits.push("Drew from the deck.");
    if (event.type === "electionSetAside") bits.push("A general election was revealed.");
    if (event.type === "electionStarted") bits.push("An election phase has begun: the market is 8 and won't refill.");
    if (event.type === "electionWon") bits.push(`${playerLabel(event.player)} won the election.`);
    if (event.type === "decreeActivated") bits.push(`${getCard(event.decreeId).name} is now active.`);
  }
  bits.push("Your turn is over. Pass the device.");
  return bits.join(" ");
}
