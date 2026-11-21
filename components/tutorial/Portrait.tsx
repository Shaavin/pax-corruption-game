import type { CastMember } from "@/lib/tutorial";

/** A cast member's monogram badge, in their color. */
export function Portrait({ member, size = "md" }: { member: CastMember; size?: "sm" | "md" | "lg" }) {
  const dimension = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-7 w-7 text-[0.6rem]" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-stone-950 ${dimension}`}
      style={{
        background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${member.color} 70%, white), ${member.color} 60%, color-mix(in srgb, ${member.color} 60%, black))`,
        boxShadow: `0 0 0 2px rgb(10 12 16), 0 0 0 3.5px ${member.color}, 0 6px 18px -6px ${member.color}`,
      }}
    >
      {member.initials}
    </span>
  );
}
