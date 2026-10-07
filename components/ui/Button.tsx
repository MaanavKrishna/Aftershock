import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "darkOutline" | "light" | "danger" | "dangerOutline";
const V: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#1c2733]",
  secondary: "border border-line-strong bg-white text-ink hover:bg-[#FAFAF8]",
  darkOutline: "border border-[#344150] bg-transparent text-on-dark hover:bg-ink-2",
  light: "bg-paper text-ink hover:bg-white",
  danger: "bg-fail-deep text-white",
  dangerOutline: "border border-[#E8C4B0] bg-white text-fail-deep",
};
const base = "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[9px] px-4 text-[13.5px] font-semibold no-underline transition-colors disabled:opacity-60";

export function ButtonLink({ href, variant = "primary", children, className = "" }: { href: string; variant?: Variant; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${base} ${V[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" {...props} className={`${base} cursor-pointer ${V[variant]} ${className}`} />;
}
