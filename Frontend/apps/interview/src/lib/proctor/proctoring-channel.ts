import {
  beaconProctoringEvents,
  submitProctoringEvents,
  type ProctoringEventInput,
} from "@/services/candidate-access-service";

/**
 * Shared delivery for all proctoring layers (browser integrity + webcam). Both layers enqueue into
 * ONE channel so there is a single ~10s POST stream and a single heartbeat — running a channel per
 * layer would make them trip the server's shared per-attempt rate limit and 429 each other.
 *
 * Responsibilities: bound queue, batched heartbeat POST, client-id dedupe is server-side, re-queue
 * on failure (at-least-once), and a sendBeacon final flush that survives unload.
 */

const DEFAULT_BATCH_INTERVAL_MS = 10_000;
/** Bound the pending queue so a long offline stretch can't grow it without limit. */
const MAX_QUEUE = 300;
/**
 * Must stay <= the server's ProctoringIngestLimits.MaxBatchSize (100). A larger POST is rejected
 * 400, which would turn any backlog into a permanent failure loop.
 */
const MAX_BATCH = 100;

export interface ProctoringChannelOptions {
  getToken: () => string;
  getFingerprint: () => string | undefined;
  batchIntervalMs?: number;
}

export type ProctoringEventExtra = Partial<
  Omit<ProctoringEventInput, "clientEventId" | "type">
>;

function newClientEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class ProctoringChannel {
  private readonly queue: ProctoringEventInput[] = [];
  private inFlight = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly batchIntervalMs: number;

  constructor(private readonly opts: ProctoringChannelOptions) {
    this.batchIntervalMs = opts.batchIntervalMs ?? DEFAULT_BATCH_INTERVAL_MS;
  }

  enqueue(type: string, extra?: ProctoringEventExtra): void {
    this.queue.push({
      clientEventId: newClientEventId(),
      type,
      startedAtUtc: extra?.startedAtUtc ?? new Date().toISOString(),
      endedAtUtc: extra?.endedAtUtc,
      confidence: extra?.confidence,
      detail: extra?.detail,
    });
    if (this.queue.length > MAX_QUEUE) {
      this.queue.splice(0, this.queue.length - MAX_QUEUE); // drop oldest
    }
  }

  /** Begin periodic heartbeat + batch delivery. Idempotent. */
  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => void this.flushAsync(true), this.batchIntervalMs);
    // Immediate proof-of-life so the reviewer sees the monitor came up at t=0.
    void this.flushAsync(true);
  }

  /** Stop delivery and make a best-effort final beacon flush. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flushBeacon(true);
  }

  private takeBatch(heartbeat: boolean): { events: ProctoringEventInput[]; heartbeat: boolean } | null {
    if (this.queue.length === 0 && !heartbeat) {
      return null;
    }
    // Never exceed the server's per-batch cap; a backlog drains across ticks.
    const events = this.queue.splice(0, Math.min(this.queue.length, MAX_BATCH));
    return { events, heartbeat };
  }

  private requeue(events: ProctoringEventInput[]): void {
    this.queue.unshift(...events);
    if (this.queue.length > MAX_QUEUE) {
      this.queue.splice(0, this.queue.length - MAX_QUEUE);
    }
  }

  /** Returns true when the batch was delivered (or there was nothing to send). */
  async flushAsync(heartbeat: boolean): Promise<boolean> {
    if (this.inFlight) {
      return false;
    }
    const batch = this.takeBatch(heartbeat);
    if (!batch) {
      return true;
    }
    this.inFlight = true;
    try {
      await submitProctoringEvents(this.opts.getToken(), {
        browserFingerprint: this.opts.getFingerprint(),
        heartbeat: batch.heartbeat,
        events: batch.events,
      });
      return true;
    } catch {
      // At-least-once: re-queue so the next tick retries (server dedupes by clientEventId).
      this.requeue(batch.events);
      return false;
    } finally {
      this.inFlight = false;
    }
  }

  /** Fire-and-forget delivery that survives unload. Only for pagehide/unmount. */
  flushBeacon(heartbeat: boolean): void {
    const batch = this.takeBatch(heartbeat);
    if (!batch) {
      return;
    }
    const ok = beaconProctoringEvents(this.opts.getToken(), {
      browserFingerprint: this.opts.getFingerprint(),
      heartbeat: batch.heartbeat,
      events: batch.events,
    });
    if (!ok) {
      this.requeue(batch.events);
    }
  }

  /**
   * Final delivery just before submit: prefer the async POST (page is alive → a rejection is
   * visible and re-queued), then beacon anything still pending. A bare beacon here could silently
   * lose the most important batch of the attempt.
   */
  async flushNow(): Promise<void> {
    await this.flushAsync(true);
    if (this.queue.length > 0) {
      this.flushBeacon(true);
    }
  }
}
