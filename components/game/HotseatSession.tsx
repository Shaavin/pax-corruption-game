"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChoiceOverlay } from "./ChoiceOverlay";
import { DecreeChoice } from "./DecreeChoice";
import { GameOverOverlay } from "./GameOverOverlay";
import { PassDeviceGate } from "./PassDeviceGate";
import { playerLabel } from "./players";
import { ReportDialog } from "./ReportDialog";
import { saveGame } from "./saved-game";
import { SetupOverlay } from "./SetupOverlay";
import { BuyEventDialog } from "./BuyEventDialog";
import { getEvent, isEventId } from "@/lib/cards/expansion";
import { Table, type DockBanner, type ExtraAction } from "./Table";
import { tableModel } from "./table-model";
import { getCard } from "@/lib/cards/catalog";
import { CardKind, type DistrictId, type PolicyIdValue } from "@/lib/cards/schema";
import {
  alliancesInPlay,
  ARCHITECTURE_COST,
  CONSTRUCT_COST,
  eastTakeTargets,
  freeActions,
  freeActionSources,
  handLikeCards,
  setAsideActions,
  type FreeActionAction,
  convincedSenators,
  convincedVotes,
  canUndo,
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
  newReplay,
  RECRUIT_COST,
  replayRecord,
  SetupStep,
  stepReplay,
  undoReplay,
  VictoryKind,
  type Action,
  type GameEvent,
  type GameModeId,
  type GameRecord,
  type GameState,
  type PlayerId,
  type Replay,
  type Victory,
} from "@/lib/game";

type Session = {
  /** Seed + every action so far; rebuilt by replay for undo and resume. */
  replay: Replay;
  /** Events since the current player's turn began, for the pass-device hint. */
  lastEvents: GameEvent[];
};

const DISTRICT_NAME: Record<DistrictId, string> = {
  dragonara: "Dragonara",
  horsard: "Horsard",
  shavvinne: "Shavvinne",
  smarbbit: "Smarbbit",
};

type SpendKind = "recruit" | "construct" | "propose" | "foreign" | "century" | "eastTake";

const FREE_LABEL: Record<FreeActionAction["ability"], (name: string, district: DistrictId | null) => string> = {
  kybernetik: () => "Kybernetik: draw to limit",
  foreignInc: (_name, district) => `Foreign Inc.: seat a ${district ? DISTRICT_NAME[district] : ""} card`,
  centuryInc: () => "Century Inc.: replace an alliance",
  architectureInc: () => "Architecture Inc.: build with 4",
  rebelInc: () => "Rebel Inc.: recruit",
  capitolInc: () => "Capitol Inc.: propose",
  intelNetwork: () => "Intel Network: inspect deck",
  eastTake: (name, district) => `${name}: take a ${district ? DISTRICT_NAME[district] : ""} Market card`,
};

type PolicyTarget = { district: DistrictId; policyId: PolicyIdValue | null };

const SET_ASIDE_LABEL = {
  planetNextBank: "Bank in Planet Next",
  consultativeOffice: "Move to Consultative Office",
  eastReveal: "Reveal (outside the hand limit)",
} as const;

const START_OF_TURN = new Set<Action["type"]>([
  "playCivil",
  "playAlliance",
  "playConspiracy",
  "recruit",
  "construct",
  "endAction",
]);


/** Online play: the server owns the game; this device is one seat. */
export type RemoteGame = {
  seat: PlayerId;
  /** This seat's redacted view, from the server. */
  state: GameState;
  history: GameEvent[];
  settings: { mode: GameModeId; expansion: boolean; foreignInfluence: boolean };
  canUndo: boolean;
  send: (action: Action) => void;
  undo: () => void;
  /** Shown in the turn dock while it is the other player's move. */
  waitingText: string;
};

type LocalProps = { remote?: undefined };
type HotseatSessionProps =
  | (LocalProps & { seed: number; mode?: GameModeId; expansion?: boolean; foreignInfluence?: boolean; record?: undefined })
  /** Resume a saved game. The caller has already checked that it replays. */
  | (LocalProps & { record: GameRecord; seed?: undefined; mode?: undefined; expansion?: undefined; foreignInfluence?: undefined })
  /** Online: render one seat of a server-run game. */
  | { remote: RemoteGame; record?: undefined; seed?: undefined; mode?: undefined; expansion?: undefined; foreignInfluence?: undefined };

export function HotseatSession(props: HotseatSessionProps) {
  const remote = props.remote ?? null;
  const [localSession, setSession] = useState<Session | null>(() =>
    props.remote
      ? null
      : {
          replay: props.record
            ? replayRecord(props.record)
            : newReplay(props.seed, { mode: props.mode, expansion: props.expansion, foreignInfluence: props.foreignInfluence }),
          lastEvents: [],
        },
  );
  const [localSeated, setSeated] = useState<PlayerId | null>(null);
  const seated = remote ? remote.seat : localSeated;
  const [selectedHandIds, setSelectedHandIds] = useState<string[]>([]);
  const [spendKind, setSpendKind] = useState<SpendKind | null>(null);
  const [proposeTarget, setProposeTarget] = useState<PolicyTarget | null>(null);
  /** Free-action source driving the current mode (Rebel, Architecture, Capitol, Foreign, Century). */
  const [via, setVia] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  /** Expansion: the event being bought (income). */
  const [buying, setBuying] = useState<string | null>(null);
  const closeReport = useCallback(() => setReportOpen(false), []);

  // In local games `session` is always set; online games never touch it.
  const session = localSession!;
  const state = remote ? remote.state : session.replay.state;
  const settings = remote
    ? remote.settings
    : { mode: session.replay.mode, expansion: session.replay.expansion, foreignInfluence: session.replay.foreignInfluence };
  const remoteHistory = remote?.history;
  const history = useMemo(
    () => remoteHistory ?? localSession!.replay.steps.flatMap((step) => step.events),
    [remoteHistory, localSession],
  );
  const actor = currentActor(state);
  // Online, each device is one seat: nothing to hide behind a pass-device screen.
  const veiled = !remote && seated !== null && seated !== actor && !state.victory;
  const waitingFirstSeat = seated === null;
  const myMove = !remote || actor === remote.seat;
  const viewer: PlayerId = seated ?? 0;
  const model = useMemo(() => tableModel(state, viewer), [state, viewer]);
  const inSetup = state.phase === Phase.Setup;
  const legal = useMemo(
    () => (veiled || waitingFirstSeat ? [] : legalActions(state, viewer)),
    [state, veiled, waitingFirstSeat, viewer],
  );

  function resetSelection() {
    setBuying(null);
    setSelectedHandIds([]);
    setSpendKind(null);
    setProposeTarget(null);
    setVia(null);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedHandIds([]);
      setSpendKind(null);
      setProposeTarget(null);
      setVia(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commit(replay: Replay, lastEvents: GameEvent[]) {
    if (remote) return;
    resetSelection();
    setSession({ replay, lastEvents });
    if (replay.steps.length > 0) saveGame(replay);
  }

  function dispatch(action: Action) {
    if (remote) {
      resetSelection();
      remote.send(action);
      return;
    }
    const replay = stepReplay(session.replay, action);
    const events = replay.steps.at(-1)!.events;
    commit(replay, START_OF_TURN.has(action.type) ? events : [...session.lastEvents, ...events]);
  }

  const undoAvailable = remote
    ? remote.canUndo && actor === viewer
    : canUndo(session.replay) && !veiled && !waitingFirstSeat && actor === viewer;

  function undo() {
    if (remote) {
      resetSelection();
      remote.undo();
      return;
    }
    if (!canUndo(session.replay)) return;
    commit(undoReplay(session.replay), []);
  }

  useEffect(() => {
    if (!undoAvailable) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Cards usable "as if in hand": hand, set-aside zones, and (State Enterprise) Market civils.
  const pool = useMemo(() => handLikeCards(state, viewer, { market: true }), [state, viewer]);
  const revealPool = useMemo(() => handLikeCards(state, viewer, { market: false }), [state, viewer]);
  const inPolitics = state.phase === Phase.Politics;
  const inAction = state.phase === Phase.Action;
  const choice = state.pending[0] ?? null;

  const playableHandIds = useMemo(() => {
    const ids = new Set<string>();
    for (const action of legal) {
      if (
        action.type === "playCivil" ||
        action.type === "playAlliance" ||
        action.type === "playConspiracy" ||
        action.type === "influenceSenate" ||
        action.type === "setAside"
      ) {
        ids.add("instanceId" in action ? action.instanceId : action.instanceIds[0]!);
      }
    }
    return ids;
  }, [legal]);

  const freeOptions = useMemo(() => (inAction ? freeActions(state, viewer) : []), [state, viewer, inAction]);
  const freeSources = useMemo(
    () =>
      freeActionSources(state, viewer).filter((source) =>
        freeOptions.some((option) => option.source === source.source && option.ability === source.ability),
      ),
    [state, viewer, freeOptions],
  );

  // --- Spending (recruit / construct, also via Rebel Inc. / Architecture Inc.) ---------
  const spendCost =
    spendKind === "recruit"
      ? RECRUIT_COST
      : spendKind === "construct"
        ? via
          ? ARCHITECTURE_COST
          : CONSTRUCT_COST
        : 0;
  const selectedDistrict = districtOfSelection(pool, selectedHandIds);
  const spendReady =
    (spendKind === "recruit" || spendKind === "construct") &&
    selectedHandIds.length === spendCost &&
    selectedDistrict !== null;

  // --- Propose Policy (also via Capitol Inc.) ----------------------------------------
  const revealedCardIds = selectedHandIds
    .map((id) => revealPool.find((card) => card.instanceId === id)?.cardId)
    .filter((id): id is string => Boolean(id));
  const proposing = spendKind === "propose";
  const revealPassing = proposing && revealedCardIds.length > 0 && revealPasses(state, revealedCardIds);
  const convinced = proposing ? new Set(convincedSenators(state, revealedCardIds)) : undefined;
  const revealVotes = proposing ? convincedVotes(state, revealedCardIds) : null;
  const wholeHandPasses = revealPool.length > 0 && revealPasses(state, revealPool.map((card) => card.cardId));

  const foreignSource = spendKind === "foreign" ? freeSources.find((source) => source.source === via) : undefined;

  const selectableHandIds = useMemo(() => {
    if (spendKind === "recruit" || spendKind === "construct") {
      return spendSelectable(pool, selectedHandIds, spendCost);
    }
    if (spendKind === "propose") {
      return proposeTarget ? new Set(selectedHandIds) : new Set(revealPool.map((card) => card.instanceId));
    }
    if (spendKind === "foreign" && foreignSource) {
      return new Set(
        revealPool
          .filter((card) => printedDistrictOrNull(card.cardId) === foreignSource.district)
          .map((card) => card.instanceId),
      );
    }
    if (spendKind === "century") {
      return new Set(revealPool.filter((card) => getCard(card.cardId).kind === CardKind.Alliance).map((card) => card.instanceId));
    }
    if (inPolitics || inAction) return playableHandIds;
    return new Set<string>();
  }, [spendKind, pool, revealPool, selectedHandIds, spendCost, proposeTarget, foreignSource, inPolitics, inAction, playableHandIds]);

  const selectedCard = selectedHandIds.length === 1 ? pool.find((card) => card.instanceId === selectedHandIds[0]) : undefined;
  const playDistrict =
    !spendKind && inAction && selectedCard && playableHandIds.has(selectedCard.instanceId)
      ? playTargetDistrict(state, viewer, selectedCard.instanceId)
      : null;
  const targetLabel =
    selectedCard && getCard(selectedCard.cardId).kind === CardKind.Conspiracy ? "Wipe this district" : "Play here";

  const claimableMonumentIds = useMemo(() => {
    const ids = new Set<string>();
    if (spendKind !== "construct" || !spendReady || !selectedDistrict) return ids;
    for (const monument of state.availableMonuments) {
      if (printedDistrict(monument.cardId) === selectedDistrict) ids.add(monument.instanceId);
    }
    return ids;
  }, [spendKind, spendReady, selectedDistrict, state.availableMonuments]);

  // Market cards you can act on: take at income, or (State Enterprise) use as if in hand.
  const eastSource = spendKind === "eastTake" ? freeSources.find((source) => source.source === via) : undefined;
  const marketIds = useMemo(() => {
    const ids = new Set<string>();
    if (spendKind === "eastTake") {
      for (const id of eastTakeTargets(state, viewer, eastSource?.district ?? null)) ids.add(id);
      return ids;
    }
    for (const action of legal) {
      if (action.type === "takeMarket") ids.add(action.instanceId);
    }
    if (inAction && !choice) {
      for (const card of state.market) {
        if (pool.some((entry) => entry.instanceId === card.instanceId)) {
          if (spendKind ? selectableHandIds.has(card.instanceId) : playableHandIds.has(card.instanceId)) {
            ids.add(card.instanceId);
          }
        }
      }
    }
    return ids;
  }, [legal, inAction, choice, state, viewer, eastSource, pool, spendKind, selectableHandIds, playableHandIds]);

  const buyableEventIds = useMemo(
    () => new Set(legal.flatMap((action) => (action.type === "buyEvent" ? [action.instanceId] : []))),
    [legal],
  );

  const canEndAction = legal.some((action) => action.type === "endAction");
  const recruitReason = recruitBlockReason(state, viewer);
  const constructReason = constructBlockReason(state, viewer);
  const declarable = inPolitics ? declarableVictories(state, viewer) : [];
  const seatArmed = inPolitics && !spendKind && selectedCard !== undefined && !state.market.includes(selectedCard);
  const setAsideFor = selectedCard
    ? setAsideActions(state, viewer).filter((action) => action.instanceIds[0] === selectedCard.instanceId)
    : [];

  function startMode(kind: SpendKind, source: string | null = null) {
    setSpendKind(kind);
    setVia(source);
    setSelectedHandIds([]);
    setProposeTarget(null);
  }

  function selectCard(instanceId: string) {
    if (spendKind === "propose") {
      if (proposeTarget) {
        if (!selectedHandIds.includes(instanceId)) return;
        const proposal = {
          revealIds: selectedHandIds,
          discardId: instanceId,
          district: proposeTarget.district,
          policyId: proposeTarget.policyId,
        };
        if (via) dispatch({ type: "freeAction", player: viewer, source: via, ability: "capitolInc", ...proposal });
        else dispatch({ type: "proposePolicy", player: viewer, ...proposal });
        return;
      }
      setSelectedHandIds((current) =>
        current.includes(instanceId) ? current.filter((id) => id !== instanceId) : [...current, instanceId],
      );
      return;
    }
    if (spendKind === "foreign" && via) {
      dispatch({ type: "freeAction", player: viewer, source: via, ability: "foreignInc", instanceId });
      return;
    }
    if (spendKind === "century") {
      setSelectedHandIds([instanceId]);
      return;
    }
    if (spendKind) {
      setSelectedHandIds((current) => toggleSpend(pool, current, instanceId, spendCost));
      return;
    }
    setSelectedHandIds((current) => (current.length === 1 && current[0] === instanceId ? [] : [instanceId]));
  }

  const extraActions: ExtraAction[] = [];
  if (spendKind) {
    extraActions.push({ label: "Cancel", tone: "ghost", onClick: resetSelection });
    if (spendKind === "recruit" && spendReady) {
      extraActions.push({
        label: via ? "Recruit (Rebel Inc.)" : "Recruit",
        onClick: () =>
          via
            ? dispatch({ type: "freeAction", player: viewer, source: via, ability: "rebelInc", instanceIds: selectedHandIds })
            : dispatch({ type: "recruit", player: viewer, instanceIds: selectedHandIds }),
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
    if (spendKind === "century" && via && selectedCard) {
      for (const target of alliancesInPlay(state)) {
        const owner = target.owner === viewer ? "yours" : "theirs";
        extraActions.push({
          label: `Replace ${getCard(target.card.cardId).name} (${owner}, ${DISTRICT_NAME[target.occupied]})`,
          onClick: () =>
            dispatch({
              type: "freeAction",
              player: viewer,
              source: via,
              ability: "centuryInc",
              instanceId: selectedCard.instanceId,
              target: { owner: target.owner, instanceId: target.card.instanceId },
            }),
        });
      }
    }
  } else if (inAction) {
    if (!state.turn.mainActionDone) {
      extraActions.push({
        label: "Recruit",
        tone: "neutral",
        disabled: recruitReason !== null,
        title: recruitReason ?? "Discard 3 cards of the same district",
        onClick: () => startMode("recruit"),
      });
      extraActions.push({
        label: "Construct",
        tone: "neutral",
        disabled: constructReason !== null,
        title: constructReason ?? "Discard 5 cards of the same district to claim a monument",
        onClick: () => startMode("construct"),
      });
    }
    for (const source of freeSources) {
      const name = isEventId(source.cardId) ? getEvent(source.cardId).name : getCard(source.cardId).name;
      const label = FREE_LABEL[source.ability](name, source.district);
      extraActions.push({
        label,
        title: "Free action · once this turn",
        onClick: () => {
          switch (source.ability) {
            case "kybernetik":
            case "intelNetwork":
              dispatch({ type: "freeAction", player: viewer, source: source.source, ability: source.ability });
              return;
            case "foreignInc":
              startMode("foreign", source.source);
              return;
            case "centuryInc":
              startMode("century", source.source);
              return;
            case "architectureInc":
              startMode("construct", source.source);
              return;
            case "rebelInc":
              startMode("recruit", source.source);
              return;
            case "capitolInc":
              startMode("propose", source.source);
              return;
            case "eastTake":
              startMode("eastTake", source.source);
              return;
          }
        },
      });
    }
    for (const action of setAsideFor) {
      extraActions.push({
        label: SET_ASIDE_LABEL[action.zone],
        tone: "neutral",
        onClick: () => dispatch(action),
      });
    }
    if (canEndAction) {
      extraActions.push({
        label: state.turn.mainActionDone ? "End action step" : "No main action — continue",
        tone: "neutral",
        onClick: () => dispatch({ type: "endAction", player: viewer }),
      });
    }
  } else if (inPolitics) {
    if (seatArmed) {
      extraActions.push({
        label: "Seat in the Senate",
        title: "The rightmost Senator is discarded to your support pile",
        onClick: () => dispatch({ type: "influenceSenate", player: viewer, instanceId: selectedCard.instanceId }),
      });
    }
    for (const action of setAsideFor) {
      extraActions.push({
        label: SET_ASIDE_LABEL[action.zone],
        tone: "neutral",
        onClick: () => dispatch(action),
      });
    }
    extraActions.push({
      label: "Propose policy",
      tone: wholeHandPasses ? "primary" : "neutral",
      disabled: !wholeHandPasses,
      title: wholeHandPasses
        ? "Reveal cards that convince more than half of the Senate"
        : "Your hand can't convince more than half of the Senate",
      onClick: () => startMode("propose"),
    });
    for (const victory of declarable) {
      extraActions.push({
        label: `Declare ${victoryLabel(victory)}`,
        onClick: () => dispatch({ type: "declareVictory", player: viewer, victory }),
      });
    }
    extraActions.push({
      label: "Skip politics",
      tone: "neutral",
      onClick: () => dispatch({ type: "endPolitics", player: viewer }),
    });
  } else if (state.phase === Phase.Income) {
    for (const action of setAsideFor) {
      extraActions.push({
        label: SET_ASIDE_LABEL[action.zone],
        tone: "neutral",
        onClick: () => dispatch(action),
      });
    }
  }

  if (undoAvailable && !spendKind) {
    extraActions.push({
      label: "Undo",
      tone: "ghost",
      title: "Take back your last action (Ctrl+Z). Not available once cards are revealed or the turn passes.",
      onClick: undo,
    });
  }

  const banner = victoryBanner(state, viewer, declarable);

  const pendingDecrees = state.phase === Phase.DecreeChoice ? state.pendingDecrees : null;

  const interaction =
    veiled || waitingFirstSeat || inSetup || state.victory || pendingDecrees || choice
      ? null
      : {
          playableHandIds: spendKind ? selectableHandIds : playableHandIds,
          selectableHandIds:
            spendKind || inAction || inPolitics || state.phase === Phase.Income ? selectableHandIds : undefined,
          selectedHandIds: new Set(selectedHandIds),
          onSelectHand: selectCard,
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
          takeableMarketIds: marketIds,
          marketMode: state.phase === Phase.Income || spendKind === "eastTake" ? ("take" as const) : ("use" as const),
          onTakeMarket: (instanceId: string) => {
            if (spendKind === "eastTake" && via) {
              dispatch({ type: "freeAction", player: viewer, source: via, ability: "eastTake", instanceId });
            } else if (state.phase === Phase.Income) dispatch({ type: "takeMarket", player: viewer, instanceId });
            else selectCard(instanceId);
          },
          buyableEventIds,
          onBuyEvent: (instanceId: string) => setBuying(instanceId),
          claimableMonumentIds,
          onClaimMonument: (instanceId: string) =>
            via
              ? dispatch({
                  type: "freeAction",
                  player: viewer,
                  source: via,
                  ability: "architectureInc",
                  instanceIds: selectedHandIds,
                  monumentInstanceId: instanceId,
                })
              : dispatch({ type: "construct", player: viewer, instanceIds: selectedHandIds, monumentInstanceId: instanceId }),
          seatArmed,
          banner,
          convincedSenators: convinced,
          revealVotes,
          prompt: turnPrompt(state, {
            spendKind,
            via: via !== null,
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

  const showGate = !remote && (waitingFirstSeat || veiled) && !state.victory;

  return (
    <Table
      model={model}
      seed={remote ? null : session.replay.seed}
      mode={settings.mode}
      expansion={settings.expansion}
      history={history}
      idlePrompt={remote && !myMove && !state.victory ? remote.waitingText : statusLine(state)}
      showTour={!veiled && !waitingFirstSeat && !inSetup && !state.victory}
      veiled={veiled || waitingFirstSeat}
      hotseat={viewer}
      interaction={myMove ? interaction : null}
      onReport={remote ? undefined : () => setReportOpen(true)}
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
      {buying && state.market.some((card) => card.instanceId === buying) && !veiled && !waitingFirstSeat ? (
        <BuyEventDialog state={state} viewer={viewer} instanceId={buying} onAction={dispatch} onClose={() => setBuying(null)} />
      ) : null}
      {choice && choice.player === viewer && !veiled && !waitingFirstSeat ? (
        <ChoiceOverlay state={state} choice={choice} viewer={viewer} onAction={dispatch} />
      ) : null}
      {state.victory ? (
        <GameOverOverlay
          victory={state.victory}
          newGameHref={
            remote
              ? "/online"
              : `/play?mode=${settings.mode}${settings.expansion ? "&expansion=1" : ""}${settings.foreignInfluence ? "&fi=1" : ""}`
          }
        />
      ) : null}
      {reportOpen && !remote ? <ReportDialog replay={session.replay} viewer={seated} onClose={closeReport} /> : null}
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

function policyName(policyId: PolicyIdValue | null): string {
  return policyId ? getCard(policyId).name : "Neutral";
}

/** Victory prompts for the turn dock: yours to declare, or the opponent's threat. */
function victoryBanner(state: GameState, viewer: PlayerId, declarable: Victory[]): DockBanner | null {
  if (state.phase !== Phase.Action && state.phase !== Phase.Politics) return null;
  const labels = (list: Victory[]) => list.map(victoryLabel).join(", ");
  if (state.phase === Phase.Politics && declarable.length > 0) {
    return { tone: "win", text: `You can declare ${labels(declarable)} now.` };
  }
  const yours = state.phase === Phase.Action ? declarableVictories(state, viewer) : [];
  if (yours.length > 0) {
    return { tone: "win", text: `Victory in reach: ${labels(yours)}. Declare it in your Politics step.` };
  }
  const theirs = declarableVictories(state, otherPlayer(viewer));
  if (theirs.length > 0) {
    return { tone: "warn", text: `${playerLabel(otherPlayer(viewer))} can declare ${labels(theirs)} in their next Politics step.` };
  }
  return null;
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
    case VictoryKind.Cultural:
      return "Cultural Victory";
    case VictoryKind.Diplomatic:
      return "Diplomatic Victory";
  }
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
    via: boolean;
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
    const buy = state.expansion ? ", or buy an event (◆ cost)" : "";
    return state.election.active
      ? `Election income · take one market card${buy} (the market does not refill)`
      : `Income · take one market card${buy}`;
  }
  if (opts.spendKind === "eastTake") return "East · pick a highlighted Market card to take into your hand";
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
  if (opts.spendKind === "foreign") return "Foreign Inc. · pick a card of its district to seat in the Senate (then draw)";
  if (opts.spendKind === "century") {
    return opts.selectedCount === 1
      ? "Century Inc. · choose the alliance to replace"
      : "Century Inc. · pick an alliance from your hand";
  }
  if (state.phase === Phase.Action && state.turn.mainActionDone) {
    return "Action · free actions remain, or end the action step";
  }
  if (opts.spendKind === "recruit") {
    return opts.spendReady
      ? "Recruit · confirm 3 cards of the same district"
      : `Recruit · select ${opts.spendCost} cards of the same district (${opts.selectedCount}/${opts.spendCost})`;
  }
  if (opts.spendKind === "construct") {
    return opts.spendReady
      ? `Construct${opts.via ? " (Architecture Inc.)" : ""} · choose a matching monument`
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
    return "Choose one of the two parties dealt to you. The lower party number goes first and keeps 3 of its 4 starting cards.";
  }
  if (state.phase === Phase.Setup && state.setup?.step === SetupStep.ChooseStartingHand) {
    return `Parties revealed. ${playerLabel(state.activePlayer)} has the lower party number, goes first, and keeps 3 of 4 starting cards. ${playerLabel(otherPlayer(state.activePlayer))} has all 4.`;
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

function printedDistrictOrNull(cardId: string): DistrictId | null {
  const def = getCard(cardId);
  return "district" in def ? def.district : null;
}
