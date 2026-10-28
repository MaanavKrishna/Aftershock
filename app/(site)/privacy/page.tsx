import type { Metadata } from "next";
import { LegalPage } from "@/components/site/LegalPage";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      updated="28 October 2026"
      sections={[
        ["Who we are", ["Aftershock is an open-source project run by Maanav Krishna and hosted at aftershock-mk.vercel.app. Questions about this policy go to maanavkrishna@gmail.com."]],
        ["What we collect", ["From GitHub when you sign in: your login, name, avatar and the organisations you belong to. We never see your GitHub password.", "From the repositories you install the app on: issues labelled as incidents, pull request metadata and diffs, and the commits needed to run tests. Source code is cloned into a temporary sandbox for a run and deleted with it; we keep test results, trimmed logs and the proven test files.", "What you and your integrations send: incidents, notes, alerts, and settings such as model keys, which are stored encrypted."]],
        ["What we don’t do", ["We don’t sell data, show ads or use tracking cookies. The only cookie is the sign-in session. We don’t use your code or incidents to train models; drafting calls go to the model provider you chose."]],
        ["Who processes data for us", ["Vercel (hosting, sandboxes, workflows), Neon (database), GitHub (sign-in and repositories) and the model provider you configure. See the security page for details."]],
        ["How long we keep it", ["Run logs and webhook deliveries: 30 days. Incidents, proofs and evidence: until you delete them, the repository or the workspace. When the app is uninstalled, the workspace is kept for 30 days and then deleted."]],
        ["Your choices", ["Admins can delete incidents, repositories and the workspace from the app, and anyone can delete their own account in Settings. You can export a workspace’s data from the API at any time."]],
      ]}
    />
  );
}
