// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@repo/api";
import {
  useAssessmentAutosave,
  type AutosaveStatus,
} from "./use-assessment-autosave";

interface SaveResult {
  version: number;
}

interface Harness {
  markDirty: () => void;
  flush: () => Promise<number>;
  reset: (version: number) => void;
  status: AutosaveStatus;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

function mount(
  save: (version: number) => Promise<SaveResult>,
  initialVersion = 1
): { harness: Harness } {
  const harness: Harness = {
    markDirty: () => {},
    flush: async () => 0,
    reset: () => {},
    status: "idle",
  };

  function Probe() {
    const autosave = useAssessmentAutosave<SaveResult>({
      initialVersion,
      save,
      versionOf: (result) => result.version,
      debounceMs: 5,
    });
    harness.markDirty = autosave.markDirty;
    harness.flush = autosave.flush;
    harness.reset = autosave.reset;
    harness.status = autosave.status;
    return null;
  }

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Probe />);
  });
  return { harness };
}

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useAssessmentAutosave", () => {
  it("threads the returned version into the next save (monotonic)", async () => {
    const versions: number[] = [];
    let next = 2;
    const save = vi.fn(async (version: number) => {
      versions.push(version);
      return { version: next++ };
    });
    const { harness } = mount(save, 1);

    await act(async () => {
      harness.markDirty();
      await tick(20);
    });
    expect(versions).toEqual([1]);

    await act(async () => {
      harness.markDirty();
      await tick(20);
    });
    // Second save must send the version the first save returned, not the stale initial.
    expect(versions).toEqual([1, 2]);
  });

  it("serializes concurrent edits into a single follow-up save", async () => {
    let resolveFirst: (() => void) | null = null;
    const save = vi.fn((version: number) => {
      if (version === 1)
        return new Promise<SaveResult>((resolve) => {
          resolveFirst = () => resolve({ version: 2 });
        });
      return Promise.resolve({ version: version + 1 });
    });
    const { harness } = mount(save, 1);

    await act(async () => {
      harness.markDirty();
      await tick(20);
    });
    expect(save).toHaveBeenCalledTimes(1); // first in flight

    // Two more edits while the first save is unresolved → collapse to one follow-up.
    await act(async () => {
      harness.markDirty();
      harness.markDirty();
      await tick(20);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.();
      await tick(20);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, 2);
  });

  it("flush resolves the latest version for a follow-up mutation", async () => {
    let next = 5;
    const save = vi.fn(async () => ({ version: next++ }));
    const { harness } = mount(save, 4);

    let flushed = 0;
    await act(async () => {
      harness.markDirty();
      flushed = await harness.flush();
    });
    expect(flushed).toBe(5);
  });

  it("parks on a version conflict and rejects flush", async () => {
    const save = vi.fn(async () => {
      throw new ApiError(412, "Precondition Failed", ["stale"], null);
    });
    const { harness } = mount(save, 1);

    await act(async () => {
      harness.markDirty();
      await tick(20);
    });
    expect(harness.status).toBe("conflict");

    await expect(harness.flush()).rejects.toBeInstanceOf(ApiError);
  });
});
