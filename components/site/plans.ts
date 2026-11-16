import { PLANS } from "@/lib/billing/plans";

/** Marketing copy for each plan. Limits come from lib/billing/plans so the page never drifts from billing. */
export const PLAN_COPY = [
  { id: "free", price: "$0", per: "forever", who: "Open source and teams up to five", cta: ["Install on GitHub", "/signin"], features: ["Unlimited public repositories", `Up to ${PLANS.free.maxCommitters} active committers on private repositories`, "Unlimited incidents and proven tests", "Checks on your own GitHub Actions, unlimited", `${PLANS.free.baseHours} sandbox CPU-hours a month`, "Community support on GitHub"] },
  { id: "team", price: "$20", per: "per active committer a month, free during the beta", who: "Product teams shipping every day", cta: ["Join the free beta", "/signin"], features: ["Everything in Free", "Unlimited active committers", `${PLANS.team.hoursPerCommitter} sandbox CPU-hours a month per committer, pooled`, "Every alert source, notifications and the MCP server", "Suggested fixes on failing checks", "Email support"] },
  { id: "business", price: "Custom", per: "invoiced", who: "Regulated and larger organisations", cta: ["Talk to us", "mailto:maanavkrishna@gmail.com?subject=Aftershock%20Business"], features: ["Everything in Team", "Signed audit evidence for every incident", "Help importing past incidents", "Priority support", "Invoiced billing"] },
] as const;

export const planLabel = (id: (typeof PLAN_COPY)[number]["id"]) => PLANS[id].label;
