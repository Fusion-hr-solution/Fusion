import { describe, expect, it, vi } from "vitest";
import { connectFusionFeed, readStreamEvents } from "../fusion-feed";

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("readStreamEvents", () => {
  it("reads complete events and keeps a split one for the next chunk", () => {
    const first = readStreamEvents(
      "retry: 5000\nevent: ready\ndata: {}\n\n: ping\n\nevent: chan"
    );
    expect(first.events).toEqual(["ready"]);
    const second = readStreamEvents(`${first.rest}ged\ndata: {}\n\n`);
    expect(second.events).toEqual(["changed"]);
    expect(second.rest).toBe("");
  });
});

describe("connectFusionFeed", () => {
  it("refetches on each change, and once after it reconnects, but not on the first open", async () => {
    const responses = [
      streamResponse([
        "event: ready\ndata: {}\n\n",
        "event: changed\ndata: {}\n\n",
      ]),
      streamResponse(["event: ready\ndata: {}\n\n"]),
    ];
    const opened: AbortSignal[] = [];
    let stop: () => void = () => {};
    const onChange = vi.fn();
    const connected: boolean[] = [];
    const done = new Promise<void>((resolve) => {
      stop = connectFusionFeed(
        async (signal) => {
          opened.push(signal);
          const next = responses.shift();
          if (!next) {
            resolve();
            return new Promise<Response>(() => {});
          }
          return next;
        },
        { onChange, onConnected: (value) => connected.push(value) },
        { sleep: async () => {} }
      );
    });

    await done;
    stop();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(connected).toEqual([true, false, true, false]);
    expect(opened.at(-1)?.aborted).toBe(true);
  });

  it("backs off while the module refuses or is down", async () => {
    const waits: number[] = [];
    let calls = 0;
    let stop: () => void = () => {};
    await new Promise<void>((resolve) => {
      stop = connectFusionFeed(
        async () => {
          calls += 1;
          if (calls === 4) resolve();
          if (calls === 2) throw new TypeError("network");
          return streamResponse([], 401);
        },
        { onChange: vi.fn(), onConnected: vi.fn() },
        {
          sleep: async (ms) => {
            waits.push(ms);
          },
        }
      );
    });
    stop();
    expect(waits.slice(0, 3)).toEqual([1_000, 2_000, 4_000]);
  });
});
