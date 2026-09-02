"use client";

import { playerLabel } from "./players";
import type { PlayerId } from "@/lib/game/types";

type PassDeviceGateProps = {
  to: PlayerId;
  firstHandoff: boolean;
  hint: string;
  onConfirm: () => void;
};

export function PassDeviceGate({
  to,
  firstHandoff,
  hint,
  onConfirm,
}: PassDeviceGateProps) {
  const name = playerLabel(to);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#16120e] px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pass-device-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage: "url(/art/box-cover.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-[#16120e]/80 to-[#16120e]" />
      <div className="relative max-w-md text-center text-stone-100">
        <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-[var(--brass)] uppercase">
          Hotseat
        </p>
        <h2 id="pass-device-title" className="mt-3 text-3xl font-semibold tracking-tight">
          {firstHandoff ? `${name}, this device is yours` : `Pass to ${name}`}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">{hint}</p>
        <button
          type="button"
          className="mt-8 cursor-pointer rounded-full bg-[var(--brass)] px-6 py-3 text-sm font-semibold tracking-wide text-stone-950 hover:bg-[#d4b57c]"
          onClick={onConfirm}
        >
          I am {name}
        </button>
      </div>
    </div>
  );
}
