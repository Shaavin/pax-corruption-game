"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { parseSavedGame, saveRecord, useSavedGameRaw } from "./saved-game";
import { APP_BUILD, copyText, downloadText, stamp } from "./share";
import { Table } from "./Table";
import { tableModel } from "./table-model";
import { getCard } from "@/lib/cards/catalog";
import { GAME_MODES } from "@/lib/game/setup";
import {
  currentActor,
  describeAction,
  encodeShareCode,
  ENGINE_VERSION,
  parseImport,
  simulate,
  type BugReport,
  type CardInstance,
  type GameRecord,
  type GameState,
  type PlayerId,
} from "@/lib/game";

type Loaded = { record: GameRecord; report: BugReport | null; source: string };

/** `/troubleshoot`: load a game record or bug report and step through it. */
export function Troubleshooter() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  if (!loaded) return <ImportScreen onLoad={setLoaded} />;
  return <ReplayViewer loaded={loaded} onClose={() => setLoaded(null)} />;
}

// --- Import ------------------------------------------------------------------------

function ImportScreen({ onLoad }: { onLoad: (loaded: Loaded) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const savedRaw = useSavedGameRaw();
  const saved = useMemo(() => (savedRaw ? parseSavedGame(savedRaw) : null), [savedRaw]);

  function load(input: string, source: string) {
    const parsed = parseImport(input);
    if (!parsed) {
      setError("That isn't a game record, bug report, or report code.");
      return;
    }
    setError(null);
    onLoad({ ...parsed, source });
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    load(await file.text(), file.name);
  }

  return (
    <div className="min-h-dvh bg-[#16120e] px-4 py-10 text-stone-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">Pax Corruption</p>
          <h1 className="mt-1 text-3xl font-semibold">Troubleshooting</h1>
          <p className="mt-2 text-sm text-stone-400">
            Load a bug report or game record to re-simulate it move by move, with both players&apos; hidden cards
            visible. Replays check every move and the engine&apos;s invariants, and point at the first thing that breaks.
          </p>
        </header>

        <Card title="Paste a report code or JSON">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={5}
            placeholder="PAX1:… or { &quot;kind&quot;: &quot;pax-bug-report&quot;, … }"
            className="w-full resize-y rounded-lg bg-black/40 p-2.5 font-mono text-xs text-stone-100 ring-1 ring-white/15 outline-none placeholder:text-stone-500 focus:ring-[var(--brass)]/60"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() => load(text, "pasted")}
              className="cursor-pointer rounded-lg bg-[var(--act)] px-4 py-2 text-sm font-semibold text-stone-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Load
            </button>
            <label className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/16">
              Open a file…
              <input
                type="file"
                accept=".json,application/json,text/plain"
                className="sr-only"
                onChange={(event) => void loadFile(event.target.files?.[0])}
              />
            </label>
          </div>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </Card>

        <Card title="This browser's saved game">
          {saved ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-stone-300 tabular-nums">
                Seed {saved.record.seed} · {saved.record.actions.length} moves{saved.over ? " · finished" : ""}
              </span>
              <button
                type="button"
                onClick={() => onLoad({ record: saved.record, report: null, source: "saved game" })}
                className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/16"
              >
                Open it
              </button>
            </div>
          ) : (
            <p className="text-sm text-stone-500">No saved game in this browser.</p>
          )}
        </Card>

        <Card title="Start a game from a seed">
          <SeedForm />
        </Card>

        <p className="text-xs text-stone-500 tabular-nums">
          Engine {ENGINE_VERSION}
          {APP_BUILD ? ` · build ${APP_BUILD}` : ""} ·{" "}
          <Link href="/" className="underline hover:text-stone-300">
            Menu
          </Link>
        </p>
      </main>
    </div>
  );
}

/** A plain GET form: `/play?seed=…`. Works without JavaScript. */
export function SeedForm() {
  return (
    <form action="/play" method="get" className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="seed-input">
        Seed
      </label>
      <input
        id="seed-input"
        name="seed"
        required
        inputMode="numeric"
        pattern="[0-9]{1,10}"
        placeholder="Seed, e.g. 7"
        className="w-40 rounded-lg bg-black/40 px-3 py-2 text-sm text-stone-100 tabular-nums ring-1 ring-white/15 outline-none placeholder:text-stone-500 focus:ring-[var(--brass)]/60"
      />
      <label className="sr-only" htmlFor="seed-mode">
        Mode
      </label>
      <select
        id="seed-mode"
        name="mode"
        defaultValue="standard"
        className="rounded-lg bg-black/40 px-2 py-2 text-sm text-stone-100 ring-1 ring-white/15 outline-none focus:ring-[var(--brass)]/60"
      >
        {GAME_MODES.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {mode.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-stone-100 hover:bg-white/16"
      >
        Start
      </button>
    </form>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <h2 className="mb-2 text-xs font-semibold tracking-[0.14em] text-stone-400 uppercase">{title}</h2>
      {children}
    </section>
  );
}

// --- Viewer ------------------------------------------------------------------------

type Tab = "moves" | "hidden" | "state";

function ReplayViewer({ loaded, onClose }: { loaded: Loaded; onClose: () => void }) {
  const { record, report } = loaded;
  const sim = useMemo(() => simulate(record), [record]);
  const last = sim.states.length - 1;
  const descriptions = useMemo(
    () => sim.steps.map((step, index) => describeAction(step.action, sim.states[index]!)),
    [sim],
  );
  const issuesAt = useMemo(() => new Map(sim.issues.map((entry) => [entry.stateIndex, entry.issues])), [sim]);
  const reportIndex = report ? Math.min(report.stepCount, last) : null;

  const [index, setIndex] = useState(() => reportIndex ?? last);
  const state = sim.states[index]!;
  const [viewAs, setViewAs] = useState<PlayerId>(() => (report?.viewer === 0 || report?.viewer === 1 ? report.viewer : currentActor(state)));
  const [tab, setTab] = useState<Tab>("moves");
  const [panelOpen, setPanelOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  const go = (next: number) => setIndex(Math.max(0, Math.min(last, next)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      else if (event.key === "ArrowRight") setIndex((current) => Math.min(last, current + 1));
      else if (event.key === "Home") setIndex(0);
      else if (event.key === "End") setIndex(last);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  const model = useMemo(() => {
    const base = tableModel(state, viewAs);
    // Troubleshooting sees everything: turn the opponent's hand face up.
    return {
      ...base,
      opponent: { ...base.opponent, hand: base.opponent.hand.map((card) => ({ ...card, faceUp: true })) },
    };
  }, [state, viewAs]);
  const history = useMemo(() => sim.steps.slice(0, index).flatMap((step) => step.events), [sim, index]);

  const prefix: GameRecord = useMemo(
    () => ({ ...record, actions: record.actions.slice(0, index) }),
    [record, index],
  );

  function playOn() {
    const ok = window.confirm(
      `Start a hotseat game from step ${index} of seed ${record.seed}? This replaces the game saved in this browser.`,
    );
    if (!ok) return;
    saveRecord({ ...prefix, engineVersion: ENGINE_VERSION, ...(APP_BUILD ? { build: APP_BUILD } : {}) }, Boolean(state.victory));
    router.push("/play?resume=1");
  }

  async function copyCode() {
    const ok = await copyText(encodeShareCode(prefix));
    setStatus(ok ? `Code for steps 0–${index} copied.` : "Couldn't reach the clipboard.");
  }

  const nextAction = index < sim.steps.length ? descriptions[index] : null;
  const idlePrompt = sim.failure && index === last
    ? `Next move fails: ${sim.failure.message}`
    : nextAction
      ? `Next: ${nextAction}`
      : state.victory
        ? "Game over"
        : "End of record";

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#16120e] text-stone-100">
      {panelOpen ? (
        <aside className="flex w-[25rem] shrink-0 flex-col border-r border-white/10 bg-black/40" aria-label="Troubleshooting">
          <div className="shrink-0 space-y-3 border-b border-white/10 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[0.6rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">Troubleshooting</p>
                <p className="text-sm font-semibold tabular-nums">
                  {GAME_MODES.find((mode) => mode.id === (record.mode ?? "standard"))?.name} · Seed {record.seed} ·{" "}
                  {record.actions.length} moves
                </p>
                <p className="truncate text-[0.68rem] text-stone-500 tabular-nums" title={loaded.source}>
                  Engine {record.engineVersion ?? "unknown"}
                  {record.build ? ` · build ${record.build}` : ""} · from {loaded.source}
                </p>
              </div>
              <SmallButton onClick={() => setPanelOpen(false)} title="Hide this panel">
                Hide
              </SmallButton>
              <SmallButton onClick={onClose}>Load another</SmallButton>
            </div>

            {sim.versionWarning ? <Notice tone="warn">{sim.versionWarning}</Notice> : null}
            {sim.failure ? (
              <Notice tone="error">
                Move {sim.failure.index + 1} can&apos;t be replayed: {sim.failure.message}
                <button type="button" className="ml-1 underline" onClick={() => go(sim.failure!.index)}>
                  Go to it
                </button>
              </Notice>
            ) : null}
            {sim.issues.length > 0 ? (
              <Notice tone="error">
                Engine invariants broke at {sim.issues.length} step{sim.issues.length === 1 ? "" : "s"}, first at step{" "}
                {sim.issues[0]!.stateIndex}.
                <button type="button" className="ml-1 underline" onClick={() => go(sim.issues[0]!.stateIndex)}>
                  Go to it
                </button>
              </Notice>
            ) : null}
            {!sim.failure && sim.issues.length === 0 ? (
              <Notice tone="ok">All {sim.steps.length} moves replay cleanly; no invariant broke.</Notice>
            ) : null}
            {report ? (
              <div className="rounded-lg bg-white/[0.05] p-2.5 text-xs ring-1 ring-white/10">
                <p className="font-semibold text-stone-200">
                  Reported at step {report.stepCount}
                  {report.viewer !== null ? ` by Player ${report.viewer + 1}` : ""}
                  {report.createdAt ? ` · ${new Date(report.createdAt).toLocaleString()}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-stone-300">{report.description || "(no description)"}</p>
                {reportIndex !== null && reportIndex !== index ? (
                  <button type="button" className="mt-1 text-[var(--brass)] underline" onClick={() => go(reportIndex)}>
                    Jump to the reported step
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-1.5">
              <SmallButton onClick={() => go(0)} title="First (Home)">⏮</SmallButton>
              <SmallButton onClick={() => go(index - 1)} title="Back (←)">◀</SmallButton>
              <input
                type="range"
                min={0}
                max={last}
                value={index}
                onChange={(event) => go(Number(event.target.value))}
                aria-label="Step"
                className="min-w-0 flex-1 accent-[var(--brass)]"
              />
              <SmallButton onClick={() => go(index + 1)} title="Forward (→)">▶</SmallButton>
              <SmallButton onClick={() => go(last)} title="Last (End)">⏭</SmallButton>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-400 tabular-nums">
              <span>
                Step {index} / {last} · {state.phase}
                {state.pending.length > 0 ? " · choice pending" : ""}
              </span>
              <span className="flex items-center gap-1">
                View as
                {([0, 1] as const).map((seat) => (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => setViewAs(seat)}
                    className={[
                      "cursor-pointer rounded px-1.5 py-0.5 font-semibold",
                      viewAs === seat ? "bg-[var(--brass)] text-stone-950" : "bg-white/10 text-stone-200 hover:bg-white/16",
                    ].join(" ")}
                  >
                    P{seat + 1}
                  </button>
                ))}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <SmallButton onClick={playOn} title="Continue this game as a hotseat game from this step">
                Play on from here
              </SmallButton>
              <SmallButton
                onClick={() => downloadText(`pax-record-seed-${record.seed}-step-${index}-${stamp()}.json`, JSON.stringify(prefix, null, 2))}
              >
                Download to here
              </SmallButton>
              <SmallButton onClick={() => void copyCode()}>Copy code to here</SmallButton>
            </div>
            {status ? <p className="text-xs text-stone-400">{status}</p> : null}
          </div>

          <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 py-2" role="tablist">
            {(["moves", "hidden", "state"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={tab === entry}
                onClick={() => setTab(entry)}
                className={[
                  "cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold capitalize",
                  tab === entry ? "bg-white/15 text-stone-100" : "text-stone-400 hover:bg-white/8",
                ].join(" ")}
              >
                {entry === "hidden" ? "Hidden info" : entry}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
            {tab === "moves" ? (
              <MoveList
                descriptions={descriptions}
                index={index}
                issuesAt={issuesAt}
                failure={sim.failure}
                reportIndex={reportIndex}
                onPick={go}
              />
            ) : tab === "hidden" ? (
              <HiddenInfo state={state} events={index > 0 ? sim.steps[index - 1]!.events : []} issues={issuesAt.get(index) ?? []} />
            ) : (
              <StateDump state={state} />
            )}
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="absolute top-2 left-2 z-[80] cursor-pointer rounded-full bg-[var(--brass)] px-3 py-1 text-xs font-semibold text-stone-950 shadow-lg"
        >
          Troubleshooting · step {index}/{last}
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        <Table
          model={model}
          seed={record.seed}
          mode={record.mode}
          history={history}
          idlePrompt={idlePrompt}
          showTour={false}
          veiled={false}
          hotseat={viewAs}
          interaction={null}
          menuHref="/troubleshoot"
        />
      </div>
    </div>
  );
}

function MoveList({
  descriptions,
  index,
  issuesAt,
  failure,
  reportIndex,
  onPick,
}: {
  descriptions: string[];
  index: number;
  issuesAt: Map<number, string[]>;
  failure: { index: number; message: string } | null;
  reportIndex: number | null;
  onPick: (index: number) => void;
}) {
  useEffect(() => {
    document.getElementById(`move-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <ol className="space-y-0.5 text-xs">
      <li>
        <MoveRow id="move-0" current={index === 0} onClick={() => onPick(0)} number="0" text="New game (setup dealt)" />
      </li>
      {descriptions.map((text, step) => {
        const stateIndex = step + 1;
        const issues = issuesAt.get(stateIndex);
        return (
          <li key={stateIndex}>
            <MoveRow
              id={`move-${stateIndex}`}
              current={index === stateIndex}
              onClick={() => onPick(stateIndex)}
              number={String(stateIndex)}
              text={text}
              flag={issues ? `⚠ ${issues.join(" · ")}` : reportIndex === stateIndex ? "◆ reported here" : undefined}
              tone={issues ? "error" : undefined}
            />
          </li>
        );
      })}
      {failure ? (
        <li className="rounded-md bg-red-500/15 px-2 py-1.5 text-red-200 ring-1 ring-red-400/40">
          <span className="font-semibold tabular-nums">{failure.index + 1}</span> ✖ {failure.message}
        </li>
      ) : null}
    </ol>
  );
}

function MoveRow({
  id,
  current,
  onClick,
  number,
  text,
  flag,
  tone,
}: {
  id: string;
  current: boolean;
  onClick: () => void;
  number: string;
  text: string;
  flag?: string;
  tone?: "error";
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-current={current ? "step" : undefined}
      className={[
        "flex w-full cursor-pointer gap-2 rounded-md px-2 py-1 text-left",
        current ? "bg-[var(--brass)]/20 ring-1 ring-[var(--brass)]/60" : "hover:bg-white/6",
        tone === "error" ? "text-red-200" : "text-stone-300",
      ].join(" ")}
    >
      <span className="w-7 shrink-0 text-right text-stone-500 tabular-nums">{number}</span>
      <span className="min-w-0 flex-1">
        <span className="break-words">{text}</span>
        {flag ? <span className="block text-[0.68rem] text-[var(--brass)]">{flag}</span> : null}
      </span>
    </button>
  );
}

function names(cards: readonly CardInstance[]): string {
  if (cards.length === 0) return "—";
  return cards.map((card) => getCard(card.cardId).name).join(", ");
}

function HiddenInfo({ state, events, issues }: { state: GameState; events: readonly unknown[]; issues: string[] }) {
  return (
    <div className="space-y-3 text-xs">
      {issues.length > 0 ? <Notice tone="error">{issues.join(" · ")}</Notice> : null}
      {state.players.map((player, seat) => (
        <section key={seat} className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
          <h3 className="mb-1 font-semibold text-stone-200">
            Player {seat + 1}
            {state.activePlayer === seat ? " · active" : ""}
            {currentActor(state) === seat ? " · to act" : ""}
          </h3>
          <Field label={`Hand (${player.hand.length})`} value={names(player.hand)} />
          <Field label="Consultative Office" value={names(player.consultativeOffice)} />
          <Field label="Planet Next bank" value={names(player.planetNextBank)} />
          <Field label="Monuments" value={names(player.monuments)} />
          <Field label="Partisans · wins · limit" value={`${player.partisans} · ${player.electionWins} · ${player.handLimit}`} />
        </section>
      ))}
      <section className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
        <h3 className="mb-1 font-semibold text-stone-200">Deck ({state.deck.length})</h3>
        <Field label="Next 10, top first" value={names(state.deck.slice(0, 10))} />
        <Field label="Monument deck" value={names(state.monumentDeck)} />
      </section>
      <section className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
        <h3 className="mb-1 font-semibold text-stone-200">Turn</h3>
        <Pre value={{ turn: state.turn, pending: state.pending, resume: state.resume, election: state.election, pendingDecrees: state.pendingDecrees }} />
      </section>
      <section className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
        <h3 className="mb-1 font-semibold text-stone-200">Events of this move ({events.length})</h3>
        <Pre value={events} />
      </section>
    </div>
  );
}

function StateDump({ state }: { state: GameState }) {
  const [status, setStatus] = useState<string | null>(null);
  const json = useMemo(() => JSON.stringify(state, null, 2), [state]);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <SmallButton onClick={async () => setStatus((await copyText(json)) ? "State copied." : "Couldn't reach the clipboard.")}>
          Copy state JSON
        </SmallButton>
        {status ? <span className="text-stone-400">{status}</span> : null}
      </div>
      <pre className="overflow-x-auto rounded-lg bg-black/40 p-2 text-[0.65rem] leading-snug text-stone-300">{json}</pre>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-0.5">
      <span className="text-stone-500">{label}: </span>
      <span className="text-stone-200">{value}</span>
    </p>
  );
}

function Pre({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded bg-black/40 p-2 text-[0.65rem] leading-snug text-stone-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Notice({ tone, children }: { tone: "ok" | "warn" | "error"; children: ReactNode }) {
  const style =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/30"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-200 ring-amber-400/30"
        : "bg-red-500/15 text-red-200 ring-red-400/40";
  return <div className={`rounded-lg px-2.5 py-1.5 text-xs ring-1 ${style}`}>{children}</div>;
}

function SmallButton({ onClick, title, children }: { onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="cursor-pointer rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-stone-100 hover:bg-white/16"
    >
      {children}
    </button>
  );
}
