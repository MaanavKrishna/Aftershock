import type { ReactNode } from "react";
import type { currentScope } from "@/lib/auth/scope";

export type Scope = Awaited<ReturnType<typeof currentScope>>["scope"];
export type Rows<K extends keyof Scope> = Scope[K] extends (...a: never[]) => Promise<infer R> ? R : never;

/** One settings panel: a titled card. `tone="danger"` gives it the recur hairline. */
export function Section({ title, sub, aside, tone, children }: { title: string; sub: ReactNode; aside?: ReactNode; tone?: "danger"; children: ReactNode }) {
  return (
    <section aria-labelledby="settings-section-h" className={`overflow-hidden rounded-card border bg-s1 shadow-e1 ${tone === "danger" ? "border-recur-line" : "border-border"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6 ${tone === "danger" ? "border-recur-line" : "border-border-soft"}`}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="settings-section-h" className={`m-0 text-title-3 font-semibold ${tone === "danger" ? "text-recur" : "text-fg"}`}>
            {title}
          </h2>
          <p className="m-0 text-callout text-fg-3">{sub}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A row inside a section: label and description on the left, a control or value on the right. */
export function Row({ title, sub, children, stack = false }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; stack?: boolean }) {
  return (
    <div className={`flex gap-x-6 gap-y-3 border-b border-border-soft px-5 py-4 last:border-b-0 sm:px-6 ${stack ? "flex-col items-start" : "flex-wrap items-center"}`}>
      <div className={`flex min-w-0 flex-col gap-0.5 ${stack ? "" : "flex-[1_1_260px]"}`}>
        <span className="text-ui font-medium text-fg">{title}</span>
        {sub && <span className="text-callout text-fg-3">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

/** Text for a section that has nothing to show yet, or that this role cannot see. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="m-0 px-5 py-6 text-ui text-fg-3 sm:px-6">{children}</p>;
}

/** Recognise the browser and OS from a user agent, in words. */
export function device(ua: string) {
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : ua ? "Browser" : "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} on ${os}` : b;
}
