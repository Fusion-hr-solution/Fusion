// ── The live nudge (B-002 N9) ──
//
// A module keeps one server-sent event stream per signed-in person that only says "your feed changed". It carries
// no content: on `changed` the shell refetches the bell and Home through the normal endpoints. The stream ends when
// the access token expires; the reader reconnects with a fresh one and backs off while the module is unreachable.

/** Event names in a chunk of `text/event-stream`, plus the incomplete tail to prepend to the next chunk. */
export function readStreamEvents(buffer: string): {
  events: string[];
  rest: string;
} {
  const frames = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = frames.pop() ?? "";
  const events = frames
    .map((frame) =>
      frame
        .split("\n")
        .find((line) => line.startsWith("event:"))
        ?.slice("event:".length)
        .trim()
    )
    .filter((event): event is string => Boolean(event));
  return { events, rest };
}

export interface FusionFeedHandlers {
  /** The feed changed: refetch it. Also called when a stream opens again after a gap, since nudges may be missed. */
  onChange: () => void;
  /** Whether a stream is open now, so polling can slow down while it is. */
  onConnected: (connected: boolean) => void;
}

export interface FusionFeedOptions {
  /** Waits between attempts; injected for tests. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const RETRY_FIRST_MS = 1_000;
const RETRY_MAX_MS = 30_000;

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Keeps a feed stream open until the returned function is called. `open` makes one request (see
 * `openPlatformEventStream`). Refused requests (401, 403, 429) and outages back off from 1 s to 30 s.
 */
export function connectFusionFeed(
  open: (signal: AbortSignal) => Promise<Response>,
  handlers: FusionFeedHandlers,
  options: FusionFeedOptions = {}
): () => void {
  const controller = new AbortController();
  const sleep = options.sleep ?? defaultSleep;

  void (async () => {
    let failures = 0;
    let openedBefore = false;
    while (!controller.signal.aborted) {
      try {
        const response = await open(controller.signal);
        if (!response.ok || !response.body)
          throw new Error(`stream ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const read = readStreamEvents(
            buffer + decoder.decode(value, { stream: true })
          );
          buffer = read.rest;
          for (const event of read.events) {
            if (event === "ready") {
              failures = 0;
              handlers.onConnected(true);
              if (openedBefore) handlers.onChange();
              openedBefore = true;
            } else if (event === "changed") {
              handlers.onChange();
            }
          }
        }
      } catch {
        if (controller.signal.aborted) break;
        failures += 1;
      }
      handlers.onConnected(false);
      if (controller.signal.aborted) break;
      // A stream that ended cleanly (token expiry) reopens after the first step; failures back off.
      await sleep(
        Math.min(RETRY_MAX_MS, RETRY_FIRST_MS * 2 ** Math.max(0, failures - 1)),
        controller.signal
      );
    }
  })();

  return () => controller.abort();
}
