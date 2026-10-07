import type { Scoped } from "@/lib/db/queries/scope";

export type ImportableIssue = { repoId: string; repo: string; number: number; title: string; closedAt: string; fixSha?: string; fixPr?: number; parentSha?: string; body: string };

const DEMO_ISSUES: Omit<ImportableIssue, "repoId">[] = [
  { repo: "ecommerce-api", number: 52, title: "Cancelled order still reserved stock", closedAt: "Oct 6", fixSha: "e4c1a90", parentSha: "d3b0f81", fixPr: 53, body: "Cancelling a pending order left its stock reservation in place, so the product showed as sold out." },
  { repo: "storefront-web", number: 215, title: "Checkout button enabled with an empty cart", closedAt: "Oct 5", fixPr: 216, fixSha: "f00ba44", parentSha: "e11cd03", body: "After removing the last item, the checkout button stayed enabled and created an empty order." },
  { repo: "billing-worker", number: 91, title: "Retry storm after provider 429", closedAt: "Sep 30", body: "The worker retried immediately on HTTP 429 and was rate-limited for an hour." },
];

/** Closed issues that can become incidents. Real GitHub listing arrives with the GitHub App; demo mode shows samples. */
export async function listImportableIssues(scope: Scoped): Promise<ImportableIssue[]> {
  const ws = await scope.workspace();
  if (ws?.installationId) {
    const { listClosedIncidentIssues } = await import("./app");
    return listClosedIncidentIssues(scope);
  }
  if (process.env.AFTERSHOCK_DEMO !== "1") return [];
  const repos = await scope.repos();
  const existing = new Set((await scope.listIncidents({})).map((i) => i.sourceRef));
  return DEMO_ISSUES.flatMap((i) => {
    const repo = repos.find((r) => r.name === i.repo);
    return repo && !existing.has(`${i.repo}#${i.number}`) ? [{ ...i, repoId: repo.id }] : [];
  });
}
