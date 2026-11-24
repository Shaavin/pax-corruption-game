import { Portrait as PaintedPortrait } from "@/components/game/Portrait";
import type { CastMember } from "@/lib/tutorial";

/** A cast member's portrait, in their color. */
export function Portrait({ member, size = "md" }: { member: CastMember; size?: "sm" | "md" | "lg" }) {
  return <PaintedPortrait src={member.portrait} color={member.color} size={size} />;
}
