import type { ComponentProps, ReactNode } from "react";

/** Data table: 40px rows, sticky header, tabular numbers, hairline rules. Wrap wide tables so only the table scrolls. */
export function Table({ children, label, className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-card border border-border bg-s1 ${className}`} role="region" aria-label={label} tabIndex={label ? 0 : undefined}>
      <table className="w-full border-collapse text-left text-ui tabular-nums">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-s1">{children}</thead>;
}

export function Th({ children, sort, className = "", ...props }: ComponentProps<"th"> & { sort?: "ascending" | "descending" | "none" }) {
  return (
    <th scope="col" aria-sort={sort} {...props} className={`h-10 border-b border-border px-4 text-callout font-medium whitespace-nowrap text-fg-3 ${className}`}>
      {children}
    </th>
  );
}

export function Tr({ children, className = "", ...props }: ComponentProps<"tr">) {
  return (
    <tr {...props} className={`border-b border-border-soft last:border-b-0 transition-colors duration-150 hover:bg-s2/60 ${className}`}>
      {children}
    </tr>
  );
}

export function Td({ children, className = "", ...props }: ComponentProps<"td">) {
  return (
    <td {...props} className={`h-10 px-4 py-2 align-middle text-fg-2 ${className}`}>
      {children}
    </td>
  );
}
