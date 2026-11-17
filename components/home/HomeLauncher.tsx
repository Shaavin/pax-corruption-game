"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ContinueGame } from "../game/ContinueGame";
import { rememberedNames, rememberNames } from "../game/players";
import { createOnlineGame, onlineConfigured } from "../online/online-client";
import { cleanName, MAX_NAME_LENGTH, nameProblem } from "@/lib/game/names";
import { GAME_MODES, isGameMode } from "@/lib/game/setup";
import { AI_LEVELS } from "@/lib/game/ai";

type Where = "local" | "computer" | "online";

/** The home page's one control surface: where to play, which deck, which expansion. */
export function HomeLauncher({ onlineOnly = false }: { onlineOnly?: boolean } = {}) {
  const router = useRouter();
  const [where, setWhere] = useState<Where>(onlineOnly ? "online" : "local");
  const [expansion, setExpansion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = where === "online";
  const computer = where === "computer";
  /** One name field (yours) online and against the computer; two for pass and play. */
  const solo = online || computer;
  const firstName = useRef<HTMLInputElement>(null);
  const secondName = useRef<HTMLInputElement>(null);

  // Prefill the names typed last time (storage is only readable after mount).
  useEffect(() => {
    const [one, two] = rememberedNames();
    if (firstName.current && !firstName.current.value && one) firstName.current.value = one;
    if (secondName.current && !secondName.current.value && two) secondName.current.value = two;
  }, [online]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const problem = nameProblem(form.get("n1")) ?? (solo ? null : nameProblem(form.get("n2")));
    if (problem) {
      event.preventDefault();
      setError(problem);
      return;
    }
    setError(null);
    const n1 = cleanName(form.get("n1"));
    const n2 = solo ? rememberedNames()[1] : cleanName(form.get("n2"));
    rememberNames([n1, n2]);
    // Local games are a plain GET to /play (names ride along as n1, n2; the computer's level as ai).
    if (!online) return;
    event.preventDefault();
    const mode = String(form.get("mode"));
    setBusy(true);
    setError(null);
    try {
      const created = await createOnlineGame({
        mode: isGameMode(mode) ? mode : "standard",
        expansion: form.get("expansion") === "1",
        foreignInfluence: form.get("fi") === "1",
        ...(n1 ? { name: n1 } : {}),
      });
      router.push(`/online/${created.gameId}`);
    } catch (caught) {
      // A network failure surfaces as a TypeError ("Failed to fetch"); say what it means.
      setError(
        caught instanceof TypeError || !(caught instanceof Error)
          ? "Couldn't reach the game server. Check your connection and try again."
          : caught.message,
      );
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="launcher-title"
      className="w-full rounded-3xl border border-white/10 bg-[#0d1117]/80 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-6"
    >
      {onlineOnly ? null : <ContinueGame />}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="launcher-title" className="text-base font-semibold whitespace-nowrap text-stone-100">
          {onlineOnly ? "New online game" : "New game"}
        </h2>
        <div
          role="tablist"
          aria-label="Where to play"
          className={onlineOnly ? "hidden" : "flex w-full rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 min-[26rem]:w-auto"}
        >
          <Tab selected={where === "local"} onClick={() => setWhere("local")}>
            Pass &amp; play
          </Tab>
          <Tab selected={computer} onClick={() => setWhere("computer")}>
            vs Computer
          </Tab>
          <Tab selected={online} onClick={() => setWhere("online")}>
            Online
          </Tab>
        </div>
      </div>
      <p className="mt-1.5 text-[0.8rem] text-stone-400">
        {online
          ? "Each player on their own device. You get a link to send your opponent."
          : computer
            ? "Play against the computer on this device. It follows the same rules and never sees your hand."
            : "Two players share this screen and pass it between turns."}
      </p>

      <form action="/play" method="get" onSubmit={submit} className="mt-5 flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-[0.7rem] font-semibold tracking-[0.14em] text-stone-500 uppercase">Deck</legend>
          <div className="grid grid-cols-2 gap-2">
            {GAME_MODES.map((mode, index) => (
              <label
                key={mode.id}
                className="group relative flex cursor-pointer flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 transition hover:border-white/20 hover:bg-white/[0.05] has-[:checked]:border-stamp-blue/70 has-[:checked]:bg-stamp-blue/[0.08] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp-blue"
              >
                <input type="radio" name="mode" value={mode.id} defaultChecked={index === 0} className="peer sr-only" />
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-100">{mode.name}</span>
                  <span className="h-3.5 w-3.5 rounded-full border border-white/25 transition group-has-[:checked]:border-[4px] group-has-[:checked]:border-stamp-blue" />
                </span>
                <span className="mt-0.5 text-[0.7rem] font-medium tracking-wide text-stone-500 uppercase">{mode.term}</span>
                <span className="mt-1.5 text-xs leading-snug text-stone-400">{mode.blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-[0.7rem] font-semibold tracking-[0.14em] text-stone-500 uppercase">Expansion</legend>
          <Switch
            name="expansion"
            checked={expansion}
            onChange={setExpansion}
            title="Legacy & Diplomacy"
            detail="World Power events, relations, and victories unlocked by legacy events."
          />
          <div className={expansion ? "" : "pointer-events-none opacity-40"} aria-disabled={!expansion}>
            <Switch
              name="fi"
              disabled={!expansion}
              title="Foreign Influence"
              detail="Start with 3 random events already in play."
            />
          </div>
        </fieldset>

        {computer ? (
          <fieldset>
            <legend className="mb-2 text-[0.7rem] font-semibold tracking-[0.14em] text-stone-500 uppercase">Difficulty</legend>
            <div className="grid grid-cols-2 gap-2">
              {AI_LEVELS.map((level) => (
                <label
                  key={level.id}
                  className="group relative flex cursor-pointer flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 transition hover:border-white/20 hover:bg-white/[0.05] has-[:checked]:border-stamp-blue/70 has-[:checked]:bg-stamp-blue/[0.08] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp-blue"
                >
                  <input type="radio" name="ai" value={level.id} defaultChecked={level.id === "normal"} className="peer sr-only" />
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-stone-100">{level.persona.name}</span>
                    <span className="h-3.5 w-3.5 rounded-full border border-white/25 transition group-has-[:checked]:border-[4px] group-has-[:checked]:border-stamp-blue" />
                  </span>
                  <span className="mt-0.5 text-[0.7rem] font-medium tracking-wide text-stone-500 uppercase">{level.name}</span>
                  <span className="mt-1.5 text-xs leading-snug text-stone-300 italic">&ldquo;{level.persona.tagline}&rdquo;</span>
                  <span className="mt-1 text-xs leading-snug text-stone-400">{level.blurb}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-[0.7rem] font-semibold tracking-[0.14em] text-stone-500 uppercase">
            {solo ? "Your name" : "Players"} <span className="font-normal tracking-normal normal-case">(optional)</span>
          </legend>
          <div className={solo ? "" : "grid grid-cols-2 gap-2"}>
            <NameInput ref={firstName} name="n1" placeholder={solo ? "Your name" : "Player 1"} label={solo ? "Your name" : "Player 1 name"} />
            {solo ? null : <NameInput ref={secondName} name="n2" placeholder="Player 2" label="Player 2 name" />}
          </div>
        </fieldset>

        {online && !onlineConfigured() ? (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-400/30">
            Online play isn&apos;t set up on this site yet.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || (online && !onlineConfigured())}
          className="group flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-pax-red px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(168,29,17,0.8)] transition hover:bg-pax-red-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-blue disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creating game…" : online ? "Create online game" : computer ? "Play the computer" : "Start on this device"}
          <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </form>
    </section>
  );
}

function NameInput({
  ref,
  name,
  placeholder,
  label,
}: {
  ref: React.Ref<HTMLInputElement>;
  name: string;
  placeholder: string;
  label: string;
}) {
  return (
    <input
      ref={ref}
      type="text"
      name={name}
      aria-label={label}
      placeholder={placeholder}
      maxLength={MAX_NAME_LENGTH}
      autoComplete="off"
      spellCheck={false}
      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-stamp-blue/70 focus:outline-none"
    />
  );
}

function Tab({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        "flex-1 cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition min-[26rem]:flex-none sm:px-3.5",
        selected ? "bg-stone-100 text-stone-950 shadow" : "text-stone-400 hover:text-stone-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Switch({
  name,
  title,
  detail,
  checked,
  onChange,
  disabled,
}: {
  name: string;
  title: string;
  detail: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-stone-100">{title}</span>
        <span className="block text-xs leading-snug text-stone-400">{detail}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        value="1"
        disabled={disabled}
        {...(onChange ? { checked, onChange: (event) => onChange(event.target.checked) } : {})}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-white/15 transition peer-checked:bg-stamp-blue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stamp-blue after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4"
      />
    </label>
  );
}
