"use client";

import { useCallback, useEffect, useRef } from "react";
import { ProctoringChannel } from "@/lib/proctor/proctoring-channel";

export interface UseProctoringChannelOptions {
  token: string;
  browserFingerprint?: string;
  /** The attempt is in progress. When false the channel is stopped (no delivery). */
  active: boolean;
  batchIntervalMs?: number;
}

export interface ProctoringChannelHandle {
  channel: ProctoringChannel;
  /** Best-effort immediate flush (used just before submit), with a sendBeacon fallback. */
  flushNow: () => Promise<void>;
}

/**
 * Owns the single shared {@link ProctoringChannel} for an attempt. Both Layer B
 * (useBrowserIntegrity) and Layer A (useProctor) enqueue into this one channel, so there is a
 * single heartbeat + POST stream regardless of how many layers are enabled.
 */
export function useProctoringChannel(
  options: UseProctoringChannelOptions
): ProctoringChannelHandle {
  // Latest token/fingerprint read lazily by the channel, so it never re-creates when they resolve.
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const channelRef = useRef<ProctoringChannel | null>(null);
  if (channelRef.current === null) {
    channelRef.current = new ProctoringChannel({
      getToken: () => optsRef.current.token,
      getFingerprint: () => optsRef.current.browserFingerprint,
      batchIntervalMs: options.batchIntervalMs,
    });
  }
  const channel = channelRef.current;

  useEffect(() => {
    if (!options.active) {
      return;
    }
    channel.start();
    return () => channel.stop();
  }, [options.active, channel]);

  const flushNow = useCallback(() => channel.flushNow(), [channel]);

  return { channel, flushNow };
}
