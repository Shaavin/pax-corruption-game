"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

export const PRIMER_KEY = "pax-primer-v1";

/**
 * How to play in a few short pages, shown before the first game's table guide and any time
 * from the menu ("How to play"). Wording follows docs/agents/game-rules.md, and changes with
 * Legacy & Diplomacy: seven victories (five start inactive), buying events, a World page.
 */
function primerPages(expansion: boolean): { title: string; body: ReactNode }[] {
  const needsLegacy = expansion ? <span className="text-stone-400"> Needs a legacy event to activate.</span> : null;
  return [
    {
      title: "Win the country",
      body: (
        <>
          <p>
            Two political parties compete for a country of four districts.{" "}
            {expansion
              ? "With Legacy & Diplomacy there are seven ways to win, but only Civil and Political are active at the start:"
              : "There are five ways to win:"}
          </p>
          <ul className="mt-2 grid gap-1.5">
            <Item name="Civil">win the final election.</Item>
            <Item name="Political">meet two active decrees at once.</Item>
            <Item name="Military">recruit 3 more partisans than your opponent.{needsLegacy}</Item>
            <Item name="Popularity">lead by 9 cards in one district&apos;s support pile.{needsLegacy}</Item>
            <Item name="Ideological">hold the most copies of one symbol (at least 4).{needsLegacy}</Item>
            {expansion ? (
              <>
                <Item name="Cultural">build 2 more monuments than your opponent.{needsLegacy}</Item>
                <Item name="Diplomatic">have a higher relation than your opponent with 3 of the 4 World Powers.{needsLegacy}</Item>
              </>
            ) : null}
          </ul>
          <p className="mt-2">
            Apart from Civil, you declare a victory in your Politics step. The <b>Victories</b> panel shows how close each
            of you is{expansion ? ", and which victories are active" : ""}.
          </p>
        </>
      ),
    },
    {
      title: "Your turn: three steps",
      body: (
        <ul className="grid gap-2">
          <Item name="Action">
            one main action: play a card to a district, recruit a partisan, or build a monument. Your alliances and
            monuments may also give free actions.
          </Item>
          <Item name="Politics">
            seat a card in the Senate, propose a policy change, or declare a victory. Or skip.
          </Item>
          <Item name="Income">
            {expansion
              ? "take a card from the Market or buy an event, then draw one if you're still under your hand limit."
              : "take a card from the Market, then draw one if you're still under your hand limit."}
          </Item>
        </ul>
      ),
    },
    {
      title: "Districts and influence",
      body: (
        <>
          <p>
            A civil card adds its number to your <b>influence</b> in its district. Cards you discard go to your{" "}
            <b>support pile</b> there, and each one is worth 1 more influence.
          </p>
          <p className="mt-2">
            Whoever has more influence in a district wins it at an election. The district&apos;s border shows who leads
            right now: teal for you, red for your opponent.
          </p>
        </>
      ),
    },
    {
      title: "Elections",
      body: (
        <>
          <p>
            Four <b>General Elections</b> are hidden in the deck. When one turns up,{" "}
            {expansion
              ? "the Market splits into two rows (8 main cards plus events) and stops refilling with main cards. Once no main cards are left, the election is scored."
              : <>the Market fills to 8 cards and stops refilling. Once it&apos;s empty, the election is scored.</>}
          </p>
          <p className="mt-2">
            The winner takes more of the 5 <b>electorates</b>: the four districts plus the Council of Lords (most alliance
            handshakes). They activate decrees, and whoever wins the last election takes Civil Victory.
          </p>
        </>
      ),
    },
    ...(expansion
      ? [
          {
            title: "World Powers and events",
            body: (
              <>
                <p>
                  Event cards from the four <b>World Powers</b> appear in the Market. At Income you may buy one instead of
                  taking a card: it costs one card from your hand for each main card to its right.
                </p>
                <ul className="mt-2 grid gap-1.5">
                  <Item name="Play it">for its effect, or into its district as a civil card.</Item>
                  <Item name="Relations">every purchase gives you +1 relation with that power.</Item>
                  <Item name="Legacy events">activate one of the inactive victories.</Item>
                </ul>
              </>
            ),
          },
        ]
      : []),
    {
      title: "Finding your way",
      body: (
        <ul className="grid gap-2">
          <Item name="Special actions">appear as bordered cards beside your hand when you can take them.</Item>
          <Item name="Something greyed out">tap it to see why it can&apos;t be used right now.</Item>
          <Item name="Any number">tap it for what it means.</Item>
          <Item name="Player aid">has the printed aid and a list of terms.</Item>
          <Item name="Table guide">a quick tour of where everything is (it starts next).</Item>
        </ul>
      ),
    },
  ];
}

function Item({ name, children }: { name: string; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-stamp-blue" />
      <span>
        <b className="text-stone-100">{name}:</b> {children}
      </span>
    </li>
  );
}

// --- Seen flag (same pattern as the table guide) --------------------------------------------

const listeners = new Set<() => void>();

function readSeen(): boolean {
  try {
    return localStorage.getItem(PRIMER_KEY) !== null;
  } catch {
    return false;
  }
}

/** Whether this browser has read or skipped the primer. True while rendering on the server. */
export function usePrimerSeen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readSeen,
    () => true,
  );
}

export function markPrimerSeen(): void {
  try {
    localStorage.setItem(PRIMER_KEY, "1");
  } catch {
    // Private mode: it will show again next time.
  }
  listeners.forEach((listener) => listener());
}

type PrimerProps = {
  page: number;
  onPage: (page: number) => void;
  onClose: () => void;
  /** First run: the last button leads into the table guide. */
  firstRun: boolean;
  /** Legacy & Diplomacy is in play: seven victories, events, the World page. */
  expansion: boolean;
};

export function Primer({ page, onPage, onClose, firstRun, expansion }: PrimerProps) {
  const pages = primerPages(expansion);
  const current = pages[Math.min(page, pages.length - 1)]!;
  const last = page >= pages.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") {
        if (last) onClose();
        else onPage(page + 1);
      } else if (event.key === "ArrowLeft" && page > 0) onPage(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, last, onPage, onClose]);

  return (
    <div className="fixed inset-0 z-[82] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="primer-title">
      <div className="rise-in glass-strong w-full max-w-md rounded-2xl p-5 text-stone-200 shadow-2xl ring-1 ring-white/10 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="label !text-stamp-blue">How to play · {page + 1} of {pages.length}</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-m-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-lg text-stone-400 hover:bg-white/8 hover:text-stone-100"
          >
            ×
          </button>
        </div>
        <h2 id="primer-title" className="mt-2 text-xl font-semibold text-stone-50">
          {current.title}
        </h2>
        <div className="mt-3 min-h-[13rem] text-[0.92rem] leading-relaxed">{current.body}</div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-1.5" aria-hidden>
            {pages.map((entry, index) => (
              <span
                key={entry.title}
                className={["h-1.5 rounded-full transition-all", index === page ? "w-4 bg-stamp-blue" : "w-1.5 bg-white/20"].join(" ")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {page > 0 ? (
              <button
                type="button"
                onClick={() => onPage(page - 1)}
                className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5"
              >
                Back
              </button>
            ) : (
              <button type="button" onClick={onClose} className="cursor-pointer px-2 py-1.5 text-sm text-stone-400 hover:text-stone-200">
                {firstRun ? "I know how to play" : "Close"}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (last ? onClose() : onPage(page + 1))}
              className="cursor-pointer rounded-xl bg-pax-red px-4 py-1.5 text-sm font-semibold text-white hover:bg-pax-red-deep"
            >
              {last ? (firstRun ? "Show me the table" : "Done") : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
