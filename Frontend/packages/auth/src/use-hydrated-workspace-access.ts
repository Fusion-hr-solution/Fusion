"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import type { AuthUser } from "./types";

/**
 * The single hydration-safe workspace-access mechanism shared by every customer
 * module (Core HR, Performance). It exists so no module can forget the guard and
 * drift back into the hydration mismatch Performance used to have.
 *
 * The session is restored by an effect in {@link AuthProvider}, which can run
 * while React is still hydrating the workspace subtree. Resolving access before
 * that point would render the workspace against server HTML that still holds the
 * skeleton, and React would discard the whole tree and rebuild it on the client.
 *
 * Holding the first client render equal to the server's (`"loading"`) until an
 * effect confirms hydration keeps hydration intact. It only ever delays showing
 * the workspace — an unresolved session already stays on the skeleton — so the
 * gate can never open earlier than before.
 *
 * `resolve` receives the restored session and returns the module's access state
 * from session claims alone (no network). The module owns its own presentation of
 * each state; this hook owns only the hydration hold and the session wiring.
 */
export interface HydratedWorkspaceAccess<TState extends string> {
  /** The resolved module access state, or `"loading"` until hydration settles. */
  state: TState | "loading";
  user: AuthUser | null;
  isLoading: boolean;
  /** False on the server and the first client render; true after hydration. */
  hydrated: boolean;
}

export function useHydratedWorkspaceAccess<TState extends string>(
  resolve: (input: { user: AuthUser | null; isLoading: boolean }) => TState,
): HydratedWorkspaceAccess<TState> {
  const { user, isLoading } = useAuth();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const state: TState | "loading" = hydrated
    ? resolve({ user, isLoading })
    : "loading";

  return { state, user, isLoading, hydrated };
}
