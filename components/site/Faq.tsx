import { Plus } from "@/components/ui/icons";

/** Questions as native disclosures: keyboard and screen-reader friendly with no script. */
export function Faq({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-col border-b border-border">
      {items.map(([q, a], i) => (
        <details key={q} open={i === 0} className="group border-t border-border">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-title-3 font-medium text-fg [&::-webkit-details-marker]:hidden">
            {q}
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-fg-3 transition-transform duration-200 ease-fl group-open:rotate-45">
              <Plus size={14} />
            </span>
          </summary>
          <p className="m-0 mb-6 max-w-[64ch] text-body text-fg-2">{a}</p>
        </details>
      ))}
    </div>
  );
}
