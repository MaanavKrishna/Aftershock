export type Role = "owner" | "admin" | "member";
export type Action = "recordIncident" | "override" | "manageIntegrations" | "manageTokens" | "manageWorkspace" | "manageRepositories";

const ADMIN_ONLY = new Set<Action>(["override", "manageIntegrations", "manageTokens", "manageWorkspace", "manageRepositories"]);

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  return ADMIN_ONLY.has(action) ? role === "owner" || role === "admin" : true;
}
