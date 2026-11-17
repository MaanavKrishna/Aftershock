"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A 1px conic highlight that turns around its child every 4s. Reserved for the single primary call to action.
 * It only turns while on screen; under reduced motion it stays still (CSS).
 */
export function MovingBorder({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.dataset.inview = "";
      else delete el.dataset.inview;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="moving-border">
      {children}
    </span>
  );
}
