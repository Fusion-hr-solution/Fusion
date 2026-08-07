"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const prevLocationKey = useRef(locationKey);

  useEffect(() => {
    if (prevLocationKey.current !== locationKey) {
      finish();
      prevLocationKey.current = locationKey;
    }
  }, [locationKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor || (anchor as HTMLAnchorElement).target) return;
      try {
        const url = new URL((anchor as HTMLAnchorElement).href);
        if (url.origin === location.origin && url.pathname !== pathname) {
          start();
        }
      } catch {
        /* noop */
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [pathname]);

  useEffect(() => {
    const handler = () => start();
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const wrapHistoryMethod =
      (method: History["pushState"]) =>
      function patchedHistoryMethod(
        this: History,
        data: unknown,
        unused: string,
        url?: string | URL | null
      ) {
        if (url) {
          try {
            const nextUrl = new URL(url.toString(), window.location.href);
            if (
              nextUrl.origin === window.location.origin &&
              nextUrl.pathname !== window.location.pathname
            ) {
              start();
            }
          } catch {
            /* noop */
          }
        }

        return method.call(this, data, unused, url);
      };

    window.history.pushState = wrapHistoryMethod(originalPushState);
    window.history.replaceState = wrapHistoryMethod(originalReplaceState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      clearTimeout(hideTimerRef.current);
    },
    []
  );

  function start() {
    clearTimeout(hideTimerRef.current);
    queueMicrotask(() => {
      setVisible(true);
      setWidth((currentWidth) => (currentWidth >= 15 ? currentWidth : 15));
    });
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setWidth((w) => Math.min(w + (100 - w) * 0.08, 85));
    }, 300);
  }

  function finish() {
    clearTimeout(hideTimerRef.current);
    setWidth(100);
    clearInterval(timerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          height: "100%",
          background: "#2d2d2d",
          width: `${width}%`,
          transition: "width 0.15s ease-out",
        }}
      />
    </div>
  );
}
