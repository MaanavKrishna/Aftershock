type Role = "owner" | "admin" | "member";

/** Why a membership change is not allowed, or null when it is. A workspace always keeps an owner. */
export function memberChange(c: { actor: Role; target: Role; to: Role | "remove"; owners: number; self: boolean }): string | null {
  const leaving = c.self && c.to === "remove";
  if (!leaving && c.actor !== "owner") return "Only owners can change roles or remove members.";
  if (c.target === "owner" && c.to !== "owner" && c.owners <= 1) return "This is the last owner. Make someone else an owner first.";
  return null;
}
