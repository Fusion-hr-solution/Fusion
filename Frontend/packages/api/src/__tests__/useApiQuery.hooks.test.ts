// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useApiQuery } from "../react/useApiQuery";

describe("useApiQuery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches data on mount and returns it", async () => {
    const queryFn = vi.fn(async () => [{ id: 1, title: "Course" }]);

    const { result } = renderHook(() => useApiQuery(queryFn));

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([{ id: 1, title: "Course" }]);
    expect(result.current.error).toBeNull();
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("passes an AbortSignal to queryFn", async () => {
    const queryFn = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return "ok";
    });

    const { result } = renderHook(() => useApiQuery(queryFn));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(queryFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("sets error on failure", async () => {
    const queryFn = vi.fn(async () => {
      throw new Error("Network failure");
    });

    const { result } = renderHook(() => useApiQuery(queryFn));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe("Network failure");
  });

  it("does not fetch when enabled is false", async () => {
    const queryFn = vi.fn(async () => "data");

    const { result } = renderHook(() =>
      useApiQuery(queryFn, { enabled: false })
    );

    // Give it a tick to potentially fire
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("fetches when enabled changes from false to true", async () => {
    const queryFn = vi.fn(async () => "data");

    const { result, rerender } = renderHook(
      ({ enabled }) => useApiQuery(queryFn, { enabled }),
      { initialProps: { enabled: false } }
    );

    expect(queryFn).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBe("data");
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("refetch re-fetches data", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      return `result-${callCount}`;
    });

    const { result } = renderHook(() => useApiQuery(queryFn));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe("result-1");

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toBe("result-2"));
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("aborts in-flight request on unmount", async () => {
    let capturedSignal: AbortSignal | null = null;
    const queryFn = vi.fn(async (signal: AbortSignal) => {
      capturedSignal = signal;
      // Simulate a slow request
      return new Promise((resolve) => setTimeout(() => resolve("data"), 1000));
    });

    const { unmount } = renderHook(() => useApiQuery(queryFn));

    // Wait for the query to start
    await waitFor(() => expect(queryFn).toHaveBeenCalled());

    unmount();

    expect(capturedSignal!.aborted).toBe(true);
  });

  it("ignores AbortError from cancelled requests", async () => {
    const queryFn = vi.fn(async (signal: AbortSignal) => {
      return new Promise<string>((_, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const { result, unmount } = renderHook(() => useApiQuery(queryFn));

    await waitFor(() => expect(queryFn).toHaveBeenCalled());
    unmount();

    // Error should not be set for abort
    expect(result.current.error).toBeNull();
  });
});
