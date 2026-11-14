"use client";

import type { PlayerNames } from "@/lib/game/names";
import { useEffect, useMemo, useState } from "react";
import { APP_BUILD, copyText, downloadText, stamp } from "./share";
import { encodeShareCode, toRecord, type BugReport, type Replay } from "@/lib/game/record";
import type { PlayerId } from "@/lib/game";

type ReportDialogProps = {
  replay: Replay;
  names?: PlayerNames;
  viewer: PlayerId | null;
  onClose: () => void;
};

/**
 * Bundle the game (seed + every action) with a description, so the problem can
 * be replayed exactly on the troubleshooting page.
 */
export function ReportDialog({ replay, names, viewer, onClose }: ReportDialogProps) {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const record = useMemo(() => toRecord(replay, APP_BUILD, names), [replay, names]);

  function buildReport(): BugReport {
    return {
      kind: "pax-bug-report",
      record,
      stepCount: record.actions.length,
      viewer,
      description: description.trim(),
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
  }

  async function copyCode() {
    const ok = await copyText(encodeShareCode(buildReport()));
    setStatus(ok ? "Report code copied. Paste it into a message to the developer." : "Couldn't reach the clipboard. Download the file instead.");
  }

  function download() {
    downloadText(`pax-report-seed-${record.seed}-${stamp()}.json`, JSON.stringify(buildReport(), null, 2));
    setStatus("Report downloaded. Send the file to the developer.");
  }

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="w-full max-w-lg rounded-2xl glass-strong p-5 text-stone-100 shadow-2xl ring-1 ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[var(--brass)] uppercase">Troubleshooting</p>
        <h2 id="report-title" className="mt-1 text-xl font-semibold">
          Report a problem
        </h2>
        <p className="mt-2 text-sm text-stone-300">
          The report contains this game&apos;s seed and every move so far, including both players&apos; hidden cards,
          so the game can be replayed exactly as it happened.
        </p>
        <label className="mt-4 block text-xs font-semibold tracking-wide text-stone-400 uppercase" htmlFor="report-text">
          What went wrong?
        </label>
        <textarea
          id="report-text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="e.g. I had 5 Horsard cards but couldn't build Planet Next."
          className="mt-1 w-full resize-y rounded-lg bg-black/40 p-2.5 text-sm text-stone-100 ring-1 ring-white/15 outline-none placeholder:text-stone-500 focus:ring-[var(--brass)]/60"
        />
        <p className="mt-2 text-[0.7rem] text-stone-500 tabular-nums">
          Seed {record.seed} · {record.actions.length} moves · engine {record.engineVersion}
          {record.build ? ` · build ${record.build}` : ""}
        </p>
        {status ? (
          <p role="status" className="mt-3 rounded-lg bg-white/6 px-3 py-2 text-sm text-stone-200">
            {status}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-stone-300 ring-1 ring-white/15 hover:bg-white/8"
          >
            Close
          </button>
          <button
            type="button"
            onClick={copyCode}
            className="cursor-pointer rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/16"
          >
            Copy report code
          </button>
          <button
            type="button"
            onClick={download}
            className="cursor-pointer rounded-lg bg-[var(--act)] px-3 py-2 text-sm font-semibold text-stone-950 hover:brightness-110"
          >
            Download report
          </button>
        </div>
      </div>
    </div>
  );
}
