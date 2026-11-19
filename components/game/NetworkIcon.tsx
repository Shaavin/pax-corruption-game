/**
 * The network mark: three linked nodes. With `locked`, a small padlock sits in the
 * bottom-right corner (the network there is enabled only for your opponent).
 */
export function NetworkIcon({ locked = false, className = "size-3.5" }: { locked?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`relative inline-flex shrink-0 ${className}`}>
      <svg viewBox="0 0 16 16" className="size-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8 4.2 4 11.3M8 4.2l4 7.1M4.6 12h6.8" />
        <circle cx="8" cy="3.4" r="2" fill="currentColor" stroke="none" />
        <circle cx="3.4" cy="12.2" r="2" fill="currentColor" stroke="none" />
        <circle cx="12.6" cy="12.2" r="2" fill="currentColor" stroke="none" />
      </svg>
      {locked ? (
        <svg
          viewBox="0 0 10 12"
          className="absolute -right-[30%] -bottom-[22%] h-[68%] w-[58%] text-stone-200 drop-shadow-[0_0_1.5px_rgb(0_0_0)]"
        >
          <path d="M2.6 5.2V3.6a2.4 2.4 0 0 1 4.8 0v1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="5" width="8" height="6.4" rx="1.3" fill="currentColor" />
        </svg>
      ) : null}
    </span>
  );
}
