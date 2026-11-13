"use client";

import Image from "next/image";
import { useEffect } from "react";

/** The printed player aid (Actions and Victories sides), side by side. */
export function PlayerAid({ onClose }: { onClose: () => void }) {
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
        className="flex max-h-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 flex-wrap items-start justify-center gap-4">
          {[
            { src: "/cards/aids/actions.png", alt: "Player aid: actions" },
            { src: "/cards/aids/victories.png", alt: "Player aid: victories" },
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
