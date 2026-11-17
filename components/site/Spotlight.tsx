"use client";
import { useRef, type ReactNode } from "react";

/**
 * Tracks the pointer over a grid and moves the glow of the card under it (CSS custom properties only;
 * the glow itself is the `spotlight-card` utility). One glow per card, nothing on touch.
 */
export function SpotlightGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  const frame = useRef(0);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-spotlight]");
    if (!card) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${clientX - r.left}px`);
      card.style.setProperty("--spot-y", `${clientY - r.top}px`);
    });
  };
  return (
    <div onPointerMove={onMove} className={className}>
      {children}
    </div>
  );
}
