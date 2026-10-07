import type { ReactNode } from "react";

export function Card({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <section className={`${dark ? "bg-ink text-on-dark" : "border border-line bg-card shadow-[0_1px_2px_rgba(14,20,27,0.04)]"} overflow-hidden rounded-[14px] ${className}`}>
      {children}
    </section>
  );
}

export function CardHead({ children, aside, dark = false, sub }: { children: ReactNode; aside?: ReactNode; dark?: boolean; sub?: ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5 ${dark ? "border-[#222C38]" : "border-[#EDEEE9]"}`}>
      <div className="flex flex-col">
        <span className="font-semibold">{children}</span>
        {sub && <span className={`text-[12.5px] ${dark ? "text-on-dark-muted" : "text-muted"}`}>{sub}</span>}
      </div>
      {aside}
    </div>
  );
}
