import type { Metadata } from "next";
import { currentScope } from "@/lib/auth/scope";
import { TopBar } from "@/components/app/TopBar";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "Get started" };

export default async function Onboarding() {
  const { scope } = await currentScope();
  const repos = await scope.repos();
  const installUrl = process.env.GITHUB_APP_SLUG ? `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new` : null;
  return (
    <>
      <TopBar title="Set up Aftershock" />
      <main id="main" className="mx-auto box-border w-full max-w-[1120px] px-6 pb-16 pt-10 max-sm:px-4 max-sm:pt-6">
        <Wizard installUrl={installUrl} repos={repos.map((r) => ({ id: r.id, name: r.name, meta: `${r.language} · ${r.framework}`, framework: r.framework, supported: true, install: r.installCmd }))} />
      </main>
    </>
  );
}
