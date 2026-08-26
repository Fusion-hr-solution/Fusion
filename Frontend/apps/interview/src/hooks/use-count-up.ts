"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous displayed value up to `target` with an ease-out curve.
 * Interruptions (e.g. switching dashboard tabs) resume from whatever is currently on screen rather
 * than snapping to 0. Fully honours `prefers-reduced-motion` — it jumps straight to the target.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const displayRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || durationMs <= 0) {
      displayRef.current = target;
      setValue(target);
      return;
    }

    const from = displayRef.current;
    const delta = target - from;
    if (delta === 0) {
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = Math.round(from + delta * eased);
      displayRef.current = current;
      setValue(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, durationMs]);

  return value;
}
