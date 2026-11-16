import { CopyText } from "./CopyText";

/** Code with an optional file name and a copy button. Lines listed in `mark` are highlighted. */
export function CodeBlock({ code, file, mark = [], copy = true }: { code: string; file?: string; mark?: number[]; copy?: boolean }) {
  return (
    <figure className="m-0 overflow-hidden rounded-panel border border-rule bg-sunken">
      {(file || copy) && (
        <figcaption className="flex min-h-11 items-center justify-between gap-3 border-b border-rule px-4 text-[13px] text-fg-3">
          <span className="truncate font-code">{file}</span>
          {copy && <CopyText text={code} />}
        </figcaption>
      )}
      <pre tabIndex={0} className="m-0 overflow-x-auto py-3.5 font-code text-[13px] leading-[1.7] text-fg-2">
        <code>
          {code.split("\n").map((line, i) => (
            <span key={i} className={`block px-4 ${mark.includes(i + 1) ? "bg-signal-soft text-fg" : ""}`}>{line || " "}</span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
