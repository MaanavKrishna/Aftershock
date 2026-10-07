import type { IncidentSource } from "@/lib/db/schema";

export const SOURCES: Record<IncidentSource, [string, string]> = {
  issue: ["GitHub issue", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 9v4 M12 16h.01"],
  postmortem: ["Postmortem", "M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5"],
  form: ["Form", "M4 5h16v14H4z M8 9h8 M8 13h5"],
  sentry: ["Sentry", "M3 18 12 4l9 14H3z M12 10v3"],
  pagerduty: ["PagerDuty", "M6 3v18 M6 4h7a4 4 0 0 1 0 8H6"],
};
