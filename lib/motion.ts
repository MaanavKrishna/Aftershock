/** Fault Line motion presets. Animate only transform and opacity; every animation must be interruptible. */

/** Toggles, pills, tabs: quick and settled. */
export const SNAPPY = { type: "spring", stiffness: 500, damping: 38 } as const;
/** Panels, sheets, row expansion. */
export const SMOOTH = { type: "spring", stiffness: 260, damping: 30 } as const;
/** Marketing reveals only. */
export const GENTLE = { type: "spring", stiffness: 140, damping: 22 } as const;

/** Ease-out used for timed transitions (same curve as the `ease-fl` CSS token). */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds: hover, UI change, entrance. Exits take about 70% of the entrance. */
export const DURATION = { hover: 0.12, ui: 0.2, enter: 0.32, exit: 0.22 } as const;

/** A fade-and-rise entrance for marketing sections. */
export const reveal = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-10% 0px" },
  transition: GENTLE,
} as const;
