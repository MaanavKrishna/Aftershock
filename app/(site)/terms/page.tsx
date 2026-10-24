import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <LegalPage
      title="Terms"
      updated="24 October 2026"
      sections={[
        ["The service", ["Aftershock turns incidents into regression tests proven against your git history and runs them on pull requests. The hosted service is in beta; features and limits may change, and we will say so in the changelog."]],
        ["Your code and data", ["You keep all rights to your code, incidents and tests. You let us process them only to provide the service: cloning repositories into sandboxes, running tests, calling the model you chose and storing results."]],
        ["Acceptable use", ["Don’t use the sandboxes for anything other than running your repository’s tests: no mining, attacks on other systems or attempts to break out of isolation. Runs that do may be stopped and the workspace suspended."]],
        ["Plans and payment", ["Free stays free. Team is free during the beta; before any charge we will give 30 days’ notice and you can leave without paying."]],
        ["No warranty", ["The software is provided as is, as in its Apache 2.0 licence. Aftershock helps prevent repeat incidents but cannot guarantee that no incident recurs; keep your own reviews and tests."]],
        ["Ending", ["You can uninstall the app and delete your workspace at any time. We may end the service with reasonable notice, and you can export your data before it ends."]],
      ]}
    />
  );
}
