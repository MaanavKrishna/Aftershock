import type { IncidentSource } from "@/lib/db/schema";

export const SOURCES: Record<IncidentSource, [string, string]> = {
  issue: ["GitHub issue", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 9v4 M12 16h.01"],
  postmortem: ["Postmortem", "M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5"],
  form: ["Form", "M4 5h16v14H4z M8 9h8 M8 13h5"],
  sentry: ["Sentry", "M3 18 12 4l9 14H3z M12 10v3"],
  pagerduty: ["PagerDuty", "M6 3v18 M6 4h7a4 4 0 0 1 0 8H6"],
  incidentio: ["incident.io", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v5 M12 16h.01"],
  linear: ["Linear", "M4 13l7 7 M4 9l11 11 M5 6l13 13 M8 4l12 12"],
  rootly: ["Rootly", "M12 21V9 M12 9c0-3 2-5 5-5 M12 13c0-3-2-5-5-5"],
  opsgenie: ["Opsgenie", "M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z"],
  datadog: ["Datadog", "M4 18l4-6 4 3 4-8 4 5 M4 21h16"],
  jira: ["Jira", "M12 3l9 9-9 9-9-9z M12 8l4 4-4 4-4-4z"],
  webhook: ["Webhook", "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
};
