import { useId, type ComponentProps, type ReactNode } from "react";

export const inputClass =
  "min-h-10 w-full rounded-control border border-field bg-s1 px-3 text-ui font-normal text-fg placeholder:text-fg-3 transition-[border-color,box-shadow] duration-150 hover:border-fg-3 focus-visible:border-signal focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-signal-soft aria-[invalid=true]:border-recur";

type Extra = { label: string; hint?: ReactNode; error?: string; className?: string };

/** Label, control, hint and error wired together: the error sets aria-invalid and is announced with the field. */
function Shell({ id, label, hint, error, className = "", children }: Extra & { id: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-callout font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="m-0 text-caption text-fg-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="m-0 text-caption font-medium text-recur">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint?: ReactNode, error?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function TextField({ label, hint, error, mono, className, ...props }: ComponentProps<"input"> & Extra & { mono?: boolean }) {
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <input {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={`${inputClass} ${mono ? "font-mono text-callout" : ""}`} />
    </Shell>
  );
}

export function TextArea({ label, hint, error, className = "flex-1 basis-[200px]", ...props }: ComponentProps<"textarea"> & Extra) {
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea rows={3} {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={`${inputClass} resize-y py-2.5`} />
    </Shell>
  );
}

export function SelectField({ label, hint, error, children, className = "flex-1 basis-[200px]", ...props }: ComponentProps<"select"> & Extra) {
  const auto = useId();
  const id = props.id ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <select {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={`${inputClass} px-2.5`}>
        {children}
      </select>
    </Shell>
  );
}

/** Form-level result: an error is an alert, success is a polite status. */
export function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (error)
    return (
      <p role="alert" className="m-0 text-callout font-medium text-recur">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="m-0 text-callout font-medium text-proven">
        {ok}
      </p>
    );
  return null;
}
