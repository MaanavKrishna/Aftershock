import Link from "next/link";

/** Link tabs (each tab is a URL, so they work without JavaScript). The current tab is marked with aria-current. */
export function Tabs({ items, label }: { items: { href: string; label: string; active: boolean; count?: number }[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="m-0 flex list-none gap-1 border-b border-border p-0 px-1">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`relative inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap px-3 text-ui font-medium no-underline transition-colors duration-150 ${t.active ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-fg" : "text-fg-3 hover:text-fg"}`}
            >
              {t.label}
              {t.count !== undefined && <span className="rounded-chip bg-s2 px-1.5 text-caption tabular-nums text-fg-2">{t.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A segmented control for in-page choices (Apple-style). Use radio inputs so it is a real form control. */
export function Segmented({ name, options, value, label }: { name: string; options: { value: string; label: string }[]; value: string; label: string }) {
  return (
    <fieldset className="m-0 inline-flex w-fit self-start rounded-control border-0 bg-s2 p-0.5">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === value} className="peer sr-only" />
          <span className="inline-flex min-h-8 items-center rounded-chip px-3 text-callout font-medium text-fg-3 transition-[background-color,color,box-shadow] duration-150 peer-checked:bg-s1 peer-checked:text-fg peer-checked:shadow-e1 peer-focus-visible:outline-2 peer-focus-visible:outline-signal">
            {o.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
