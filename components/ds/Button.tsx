import Link from "next/link";

type Variant = "primary" | "secondary" | "quiet";
const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-[15px] font-semibold no-underline transition-[background-color,border-color,color] duration-150";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-fg text-canvas hover:bg-fg-2",
  secondary: "border border-rule-strong bg-transparent text-fg hover:border-fg-3",
  quiet: "px-3 text-fg-2 hover:text-fg",
};

export function DsLink({ href, variant = "primary", children, className = "" }: { href: string; variant?: Variant; children: React.ReactNode; className?: string }) {
  const external = /^https?:/.test(href);
  return external ? (
    <a href={href} className={`${base} ${VARIANTS[variant]} ${className}`} rel="noopener">{children}</a>
  ) : (
    <Link href={href} className={`${base} ${VARIANTS[variant]} ${className}`}>{children}</Link>
  );
}
