"use client";
import { useState } from "react";

export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
      className="min-h-8 cursor-pointer rounded-chip border border-rule bg-transparent px-2.5 font-ui text-xs text-fg-2 hover:text-fg"
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
