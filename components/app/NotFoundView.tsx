import { TopBar, Main } from "./TopBar";
import { ButtonLink } from "@/components/ui/Button";

/** Unknown or inaccessible incident / pull request numbers, inside the app shell. */
export function NotFoundView({ what, back, backLabel }: { what: string; back: string; backLabel: string }) {
  return (
    <>
      <TopBar crumbs={[{ label: backLabel, href: back }, { label: "Not found" }]} />
      <Main>
        <div className="flex max-w-xl flex-col items-start gap-3 py-10">
          <span className="font-mono text-caption text-fg-3">404</span>
          <h1 className="m-0 text-title-1 font-semibold text-fg">Nothing here, or nothing you can see.</h1>
          <p className="m-0 text-ui text-fg-2">
            This {what} doesn’t exist in this workspace. It may have been deleted, or it belongs to a workspace you’re not signed in to.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ButtonLink href={back}>{`Back to ${backLabel.toLowerCase()}`}</ButtonLink>
            <ButtonLink href="/overview" variant="secondary">
              Overview
            </ButtonLink>
          </div>
        </div>
      </Main>
    </>
  );
}
