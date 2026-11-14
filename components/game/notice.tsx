"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type NoticeContextValue = { notify: (text: string) => void };

const NoticeContext = createContext<NoticeContextValue>({ notify: () => {} });

/** Show a short note, e.g. why something can't be used (touch screens have no tooltips). */
export function useNotice(): (text: string) => void {
  return useContext(NoticeContext).notify;
}

/** Provides `useNotice` and shows the latest note above the hand for a few seconds. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);
  const notify = useCallback((text: string) => setNotice((current) => ({ text, id: (current?.id ?? 0) + 1 })), []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), Math.min(7000, 2500 + notice.text.length * 35));
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <NoticeContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[34%] z-[75] flex justify-center px-4 lg:bottom-[26%]">
        {notice ? (
          <button
            key={notice.id}
            type="button"
            onClick={() => setNotice(null)}
            className="rise-in pointer-events-auto max-w-sm cursor-pointer rounded-xl bg-[#0d1117]/95 px-4 py-2.5 text-center text-sm leading-snug text-stone-100 shadow-2xl ring-1 ring-amber-300/40"
          >
            {notice.text}
          </button>
        ) : null}
      </div>
    </NoticeContext.Provider>
  );
}
