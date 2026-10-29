"use client";

import { useEffect, useState } from "react";

/**
 * Lands on the item a notification opened (B-154): `#feedback-{id}` scrolls the element with that id into view and
 * outlines it for a moment, once `ready` says its list has loaded. The hash stays: a list that mounts again (Next
 * re-renders the page once after loading) lands again instead of losing the outline. When the item isn't on the page
 * (an older one, or another tab's), `onMissing` gets its id, e.g. to open it in a drawer instead.
 */
export function useLanding(prefix: string, ready: boolean, onMissing?: (id: string) => void): void {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      setTarget(hash.startsWith(`${prefix}-`) ? hash.slice(prefix.length + 1) : null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [prefix]);

  useEffect(() => {
    if (!target || !ready) return;
    setTarget(null);
    const element = document.getElementById(`${prefix}-${target}`);
    if (!element) {
      onMissing?.(target);
      return;
    }
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.classList.remove("animate-land");
    void element.offsetWidth;
    element.classList.add("animate-land");
    // Animations inside the item bubble their end up here too; only the outline's own end clears it.
    const done = (event: AnimationEvent) => {
      if (event.target !== element) return;
      element.classList.remove("animate-land");
      element.removeEventListener("animationend", done);
    };
    element.addEventListener("animationend", done);
  }, [target, ready, prefix, onMissing]);
}
