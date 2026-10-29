"use client";

import { useEffect } from "react";

// ── The moment a notification arrives (B-154) ──
//
// Browser-side pieces of the bell: the chime, which open tab plays it, and the unread count in the tab's title and
// icon. Each degrades quietly where the browser says no (no audio before a click, no Web Locks, no storage).

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  audio ??= new Context();
  return audio;
}

/**
 * Browsers only let a page make sound after the person has interacted with it, so the audio context is created or
 * resumed on the first click or key press in this tab.
 */
export function useChimeUnlock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      void context()?.resume().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);
}

/** A soft two-note chime (A5 then E6), under a second. Silent when the browser hasn't allowed sound yet. */
export function playChime(): void {
  const ctx = context();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + 0.01;
  for (const [frequency, delay] of [
    [880, 0],
    [1318.5, 0.11],
  ] as const) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.09, start + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.55);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + 0.6);
  }
}

const CLAIMED_KEY = "fusion:notification-chimed";
const CLAIMS_KEPT = 50;

function takeClaim(key: string): boolean {
  try {
    const claimed: string[] = JSON.parse(localStorage.getItem(CLAIMED_KEY) ?? "[]");
    if (claimed.includes(key)) return false;
    localStorage.setItem(CLAIMED_KEY, JSON.stringify([key, ...claimed].slice(0, CLAIMS_KEPT)));
    return true;
  } catch {
    return true;
  }
}

/**
 * Whether this tab plays the chime for an arrival. Every open tab hears the same nudge; the first to claim the arrival
 * plays it. The tab in front claims at once, tabs behind wait a moment so the one in front wins, and a tab that was
 * never clicked can't play sound, so it stays out.
 */
export async function claimChime(key: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const visible = document.visibilityState === "visible";
  if (!visible) {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (navigator.locks?.request) {
    return navigator.locks.request("fusion-notification-chime", () => takeClaim(key));
  }
  return takeClaim(key);
}

const COUNT_PREFIX = /^\(\d+\)\s/;

/** "(2) Home · Fusion" and a dot on the tab's icon while something is unread, for when Fusion sits behind other windows. */
export function useTabUnreadCount(count: number): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const apply = () => {
      const bare = document.title.replace(COUNT_PREFIX, "");
      const next = count > 0 ? `(${count}) ${bare}` : bare;
      if (document.title !== next) document.title = next;
    };
    apply();
    // Next.js rewrites the title on navigation; put the count back each time.
    const observer = new MutationObserver(apply);
    const head = document.head;
    observer.observe(head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(COUNT_PREFIX, "");
    };
  }, [count]);

  const unread = count > 0;
  useEffect(() => {
    if (typeof document === "undefined" || !unread) return;
    const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!icon) return;
    const original = icon.href;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const draw = canvas.getContext("2d");
      if (!draw) return;
      draw.drawImage(image, 0, 0, size, size);
      const dot = getComputedStyle(document.documentElement).getPropertyValue("--destructive").trim() || "#e5484d";
      draw.beginPath();
      draw.arc(size - 13, 13, 12, 0, Math.PI * 2);
      draw.fillStyle = dot;
      draw.fill();
      try {
        icon.href = canvas.toDataURL("image/png");
      } catch {
        // A cross-origin icon taints the canvas; the title still carries the count.
      }
    };
    image.src = original;
    return () => {
      cancelled = true;
      icon.href = original;
    };
  }, [unread]);
}
