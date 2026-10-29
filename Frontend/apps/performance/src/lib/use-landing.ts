"use client";

import { useEffect, useState } from "react";

/**
 * Lands on the item a notification opened (B-154): `#feedback-{id}` scrolls the element with that id into view and
 * outlines it for a moment, once `ready` says its list has loaded. The hash is then dropped, so going back or
 * reloading doesn't land again. When the item isn't on the page (an older one, or another tab's), `onMissing` gets
 * its id, e.g. to open it in a drawer instead.
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
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    const element = document.getElementById(`${prefix}-${target}`);
    if (!element) {
      onMissing?.(target);
      return;
    }
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.classList.remove("animate-land");
    void element.offsetWidth;
    element.classList.add("animate-land");
    element.addEventListener("animationend", () => element.classList.remove("animate-land"), { once: true });
  }, [target, ready, prefix, onMissing]);
}
