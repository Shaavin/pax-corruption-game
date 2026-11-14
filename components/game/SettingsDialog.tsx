"use client";

import { useEffect, type ReactNode } from "react";
import { updateSettings, useSettings, type Settings } from "./settings";

/** Per-device preferences: hotseat replays and card animations. */
export function SettingsDialog({ onClose, hotseat }: { onClose: () => void; hotseat: boolean }) {
  const settings = useSettings();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="rise-in glass-strong w-full max-w-sm rounded-2xl p-5 shadow-2xl ring-1 ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-semibold text-stone-100">
            Settings
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-lg text-stone-400 hover:bg-white/8 hover:text-stone-100"
          >
            ×
          </button>
        </div>
        <p className="mt-0.5 text-xs text-stone-400">Saved on this device.</p>

        <div className="mt-4 flex flex-col gap-4">
          <Row title="Card animations" detail="Cards slide to where they're played, drawn, or discarded.">
            <Segmented
              value={settings.motion}
              options={[
                ["off", "Off"],
                ["normal", "Normal"],
                ["fast", "Fast"],
              ]}
              onChange={(motion) => updateSettings({ motion: motion as Settings["motion"] })}
            />
          </Row>
          {hotseat ? (
            <Row title="Replay the other player's moves" detail="After the device is handed over, watch their turn one move at a time.">
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.replay}
                  onChange={(event) => updateSettings({ replay: event.target.checked })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="relative h-6 w-10 rounded-full bg-white/15 transition peer-checked:bg-[var(--brass)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--brass)] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4"
                />
                <span className="sr-only">Replay the other player&apos;s moves</span>
              </label>
            </Row>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-stone-100">{title}</p>
        <p className="text-xs leading-snug text-stone-400">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex rounded-full bg-white/[0.06] p-0.5 ring-1 ring-white/10">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={[
            "cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold",
            value === id ? "bg-stone-100 text-stone-950" : "text-stone-300 hover:text-stone-100",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
