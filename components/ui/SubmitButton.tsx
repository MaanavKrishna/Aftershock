"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** A submit button that shows progress while its server action runs. */
export function SubmitButton({ children, pendingLabel, className = "" }: { children: ReactNode; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
