"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type ExitHandler = () => void | Promise<void>;

interface SetupShell {
  /** A step registers how "Save and exit" should behave while it is mounted (null to clear). */
  setExitHandler: (handler: ExitHandler | null) => void;
  /** Invoked by the shared header. Falls back to a plain exit when no step handler is registered. */
  runExit: () => void;
}

const Ctx = createContext<SetupShell | null>(null);

export function SetupShellProvider({ fallbackExit, children }: { fallbackExit: () => void; children: ReactNode }) {
  const handlerRef = useRef<ExitHandler | null>(null);
  const setExitHandler = useCallback((handler: ExitHandler | null) => {
    handlerRef.current = handler;
  }, []);
  const runExit = useCallback(() => {
    if (handlerRef.current) void handlerRef.current();
    else fallbackExit();
  }, [fallbackExit]);

  const value = useMemo(() => ({ setExitHandler, runExit }), [setExitHandler, runExit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSetupShell(): SetupShell {
  return (
    useContext(Ctx) ?? {
      setExitHandler: () => {},
      runExit: () => {},
    }
  );
}
