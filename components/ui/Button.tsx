import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * primary: the one main action (inverted text colour). accent: the signal-blue call to action.
 * secondary: outlined. quiet: text only. danger / dangerOutline: destructive.
 * darkOutline and light are older names kept for existing pages.
 */
export type Variant = "primary" | "accent" | "secondary" | "quiet" | "danger" | "dangerOutline" | "darkOutline" | "light";
export type Size = "sm" | "md" | "lg";

const V: Record<Variant, string> = {
  primary: "bg-fg text-canvas hover:bg-fg/90",
  accent: "bg-signal text-on-signal hover:bg-signal/90",
  secondary: "border border-border-strong bg-s1 text-fg hover:bg-s2",
  quiet: "bg-transparent text-fg-2 hover:bg-s2 hover:text-fg",
  danger: "bg-recur text-on-signal hover:bg-recur/90",
  dangerOutline: "border border-recur-line bg-s1 text-recur hover:bg-recur-soft",
  darkOutline: "border border-border-strong bg-s1 text-fg hover:bg-s2",
  light: "border border-border-strong bg-s1 text-fg hover:bg-s2",
};
const S: Record<Size, string> = {
  sm: "min-h-8 px-3 text-callout",
  md: "min-h-10 px-4 text-ui",
  lg: "min-h-12 px-5 text-body",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", className = "") =>
  `inline-flex cursor-pointer items-center justify-center gap-2 rounded-control font-medium no-underline transition-[background-color,border-color,color,transform] duration-150 ease-fl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${S[size]} ${V[variant]} ${className}`;

export function ButtonLink({ href, variant = "primary", size = "md", children, className = "" }: { href: string; variant?: Variant; size?: Size; children: ReactNode; className?: string }) {
  const cls = buttonClass(variant, size, className);
  return /^https?:/.test(href) ? (
    <a href={href} className={cls} rel="noopener">
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/** Marketing links default to the large size. */
export function DsLink({ size = "lg", ...props }: Parameters<typeof ButtonLink>[0]) {
  return <ButtonLink size={size} {...props} />;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={buttonClass(variant, size, className)} />;
}

export function IconButton({ label, className = "", ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control bg-transparent text-fg-2 transition-colors duration-150 hover:bg-s2 hover:text-fg ${className}`}
    />
  );
}
