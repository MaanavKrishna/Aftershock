"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * A figure that counts up once, in under 600ms, when the page first shows it. The server renders the real number
 * (so it reads correctly without script); screen readers get the final value only. Later refreshes just update it.
 */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const done = useRef(false);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    if (done.current || reduce || value <= 0) {
      setShown(value);
      return;
    }
    done.current = true;
    const c = animate(0, value, { duration: Math.min(0.55, 0.25 + value * 0.03), ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [value, reduce]);
  return (
    <span className={className}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
