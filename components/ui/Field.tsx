import type { ComponentProps } from "react";

const input = "min-h-[46px] rounded-[9px] border border-field bg-white px-3 font-normal text-ink";

export function TextField({ label, mono, ...props }: ComponentProps<"input"> & { label: string; mono?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      <input {...props} className={`${input} ${mono ? "font-mono text-[13px]" : ""}`} />
    </label>
  );
}

export function TextArea({ label, ...props }: ComponentProps<"textarea"> & { label: string }) {
  return (
    <label className="flex flex-1 basis-[200px] flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      <textarea rows={3} {...props} className="resize-y rounded-[9px] border border-field bg-white px-3 py-2.5 font-normal text-ink" />
    </label>
  );
}

export function SelectField({ label, children, ...props }: ComponentProps<"select"> & { label: string }) {
  return (
    <label className="flex flex-1 basis-[200px] flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      <select {...props} className={`${input} px-2.5`}>
        {children}
      </select>
    </label>
  );
}
