"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ContinueGame } from "../game/ContinueGame";
import { createOnlineGame, onlineConfigured } from "../online/online-client";
import { GAME_MODES, isGameMode } from "@/lib/game/setup";

type Where = "local" | "online";

/** The home page's one control surface: where to play, which deck, which expansion. */
export function HomeLauncher() {
  const router = useRouter();
  const [where, setWhere] = useState<Where>("local");
  const [expansion, setExpansion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = where === "online";

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!online) return; // Local games are a plain GET to /play.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mode = String(form.get("mode"));
    setBusy(true);
    setError(null);
    try {
      const created = await createOnlineGame({
        mode: isGameMode(mode) ? mode : "standard",
        expansion: form.get("expansion") === "1",
        foreignInfluence: form.get("fi") === "1",
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
      <ContinueGame />

      <div className="flex items-center justify-between gap-3">
        <h2 id="launcher-title" className="text-base font-semibold text-stone-100">
          New game
        </h2>
        <div role="tablist" aria-label="Where to play" className="flex rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
          <Tab selected={!online} onClick={() => setWhere("local")}>
            This device
          </Tab>
          <Tab selected={online} onClick={() => setWhere("online")}>
            Online
          </Tab>
        </div>
      </div>
      <p className="mt-1.5 text-[0.8rem] text-stone-400">
        {online
          ? "Each player on their own device. You get a link to send your opponent."
          : "Two players share this screen and pass it between turns."}
      </p>

      <form action="/play" method="get" onSubmit={submit} className="mt-5 flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-[0.7rem] font-semibold tracking-[0.14em] text-stone-500 uppercase">Deck</legend>
          <div className="grid grid-cols-2 gap-2">
            {GAME_MODES.map((mode, index) => (
              <label
                key={mode.id}
                className="group relative flex cursor-pointer flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 transition hover:border-white/20 hover:bg-white/[0.05] has-[:checked]:border-[var(--brass)]/70 has-[:checked]:bg-[var(--brass)]/[0.08] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brass)]"
              >
                <input type="radio" name="mode" value={mode.id} defaultChecked={index === 0} className="peer sr-only" />
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-100">{mode.name}</span>
                  <span className="h-3.5 w-3.5 rounded-full border border-white/25 transition group-has-[:checked]:border-[4px] group-has-[:checked]:border-[var(--brass)]" />
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

        {online && !onlineConfigured() ? (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-400/30">
            Online play isn&apos;t set up on this site yet.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || (online && !onlineConfigured())}
          className="group flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--brass)] px-6 py-3.5 text-sm font-semibold text-stone-950 shadow-[0_10px_30px_-10px_rgba(198,165,108,0.7)] transition hover:bg-[#d6b97f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creating game…" : online ? "Create online game" : "Start on this device"}
          <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </form>
    </section>
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
        "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
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
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-white/15 transition peer-checked:bg-[var(--brass)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brass)] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4"
      />
    </label>
  );
}
