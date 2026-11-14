"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { EXPANSION_TERMS, TERMS } from "./terms";

/** The printed player aid (Actions and Victories sides), side by side. */
export function PlayerAid({ onClose, expansion = false }: { onClose: () => void; expansion?: boolean }) {
  const base = expansion ? "/cards/expansion/aids" : "/cards/aids";
  const [tab, setTab] = useState<"aid" | "terms">("aid");
  const terms = expansion ? [...TERMS, ...EXPANSION_TERMS] : TERMS;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Player aid"
        className="flex max-h-full w-full max-w-5xl flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div role="tablist" aria-label="Player aid" className="flex rounded-full bg-white/[0.08] p-1 ring-1 ring-white/10">
          {(
            [
              ["aid", "Player aid"],
              ["terms", "Terms"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={[
                "cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold",
                tab === id ? "bg-stone-100 text-stone-950" : "text-stone-300 hover:text-stone-100",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "terms" ? (
          <dl className="glass-strong grid max-h-[min(78dvh,40rem)] w-full max-w-3xl gap-x-6 gap-y-3 overflow-y-auto rounded-2xl p-5 text-sm sm:grid-cols-2">
            {terms.map((entry) => (
              <div key={entry.term}>
                <dt className="font-semibold text-stone-100">{entry.term}</dt>
                <dd className="mt-0.5 leading-snug text-stone-300">{entry.meaning}</dd>
              </div>
            ))}
          </dl>
        ) : (
        <div className="flex min-h-0 flex-wrap items-start justify-center gap-4">
          {[
            { src: `${base}/actions.png`, alt: "Player aid: actions" },
            { src: `${base}/victories.png`, alt: "Player aid: victories" },
          ].map((side) => (
            <Image
              key={side.src}
              src={side.src}
              alt={side.alt}
              width={825}
              height={1125}
              className="h-[min(78dvh,34rem)] w-auto rounded-xl shadow-2xl ring-1 ring-white/10"
              priority
            />
          ))}
        </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-stone-200 ring-1 ring-white/20 hover:bg-white/8"
        >
          Close
        </button>
      </div>
    </div>
  );
}
