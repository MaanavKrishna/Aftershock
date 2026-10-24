"use client";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/** Loads only the DOM animation features, and turns movement off for people who ask for reduced motion. */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
