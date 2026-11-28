/**
 * A computer opponent's portrait: a painting in a ring of their color. The ring is inside its
 * box (nothing it sits beside is covered); only the larger sizes cast a soft glow. Decorative:
 * their name is always beside it.
 */
export function Portrait({
  src,
  color,
  size = "md",
  title,
}: {
  src: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  /** Hover text (the character's name). */
  title?: string;
}) {
  const dimension = { xs: "h-6 w-6", sm: "h-8 w-8", md: "h-11 w-11", lg: "h-16 w-16" }[size];
  const small = size === "xs" || size === "sm";
  // The colored ring, then a dark gap before the painting.
  const ring = small ? 1.5 : 2;
  const gap = size === "xs" ? 1 : small ? 1.5 : 2;
  return (
    <span
      aria-hidden
      title={title}
      className={`block shrink-0 rounded-full ${dimension}`}
      style={{ padding: ring, background: color, boxShadow: small ? undefined : `0 6px 18px -6px ${color}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a small file, saved for offline play as it is (not through the image optimizer) */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="block h-full w-full rounded-full bg-stone-900 object-cover"
        style={{ border: `${gap}px solid rgb(10 12 16)` }}
      />
    </span>
  );
}
