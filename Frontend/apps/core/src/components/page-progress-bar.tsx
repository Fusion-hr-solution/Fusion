"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function PageProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      finish();
      prevPath.current = pathname;
    }
  }, [pathname]);

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

  useEffect(() => () => clearInterval(timerRef.current), []);

  function start() {
    setVisible(true);
    setWidth(15);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setWidth((w) => Math.min(w + (100 - w) * 0.08, 85));
    }, 300);
  }

  function finish() {
    setWidth(100);
    clearInterval(timerRef.current);
    setTimeout(() => {
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
