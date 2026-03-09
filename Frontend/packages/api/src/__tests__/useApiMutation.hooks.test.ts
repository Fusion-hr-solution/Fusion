// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useApiMutation } from "../react/useApiMutation";

describe("useApiMutation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not execute on mount", () => {
    const mutationFn = vi.fn(async () => "result");

    const { result } = renderHook(() => useApiMutation(mutationFn));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it("mutate triggers the mutation and sets data", async () => {
    const mutationFn = vi.fn(async (name: string) => ({ id: 1, name }));

    const { result } = renderHook(() =>
      useApiMutation<{ id: number; name: string }, string>(mutationFn)
    );

    act(() => {
      result.current.mutate("Test");
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ id: 1, name: "Test" });
    expect(result.current.error).toBeNull();
  });

  it("mutateAsync returns the result as a promise", async () => {
    const mutationFn = vi.fn(async () => 42);

    const { result } = renderHook(() => useApiMutation(mutationFn));

    let returned: number | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync(undefined as void);
    });

    expect(returned).toBe(42);
    expect(result.current.data).toBe(42);
  });

  it("sets error on failure", async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error("Server error");
    });

    const { result } = renderHook(() => useApiMutation(mutationFn));

    act(() => {
      result.current.mutate(undefined as void);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe("Server error");
    expect(result.current.data).toBeUndefined();
  });

  it("mutateAsync rejects on failure", async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error("fail");
    });

    const { result } = renderHook(() => useApiMutation(mutationFn));

    await act(async () => {
      await expect(
        result.current.mutateAsync(undefined as void)
      ).rejects.toThrow("fail");
    });
  });

  it("calls onSuccess callback on success", async () => {
    const onSuccess = vi.fn();
    const mutationFn = vi.fn(async () => "ok");

    const { result } = renderHook(() =>
      useApiMutation(mutationFn, { onSuccess })
    );

    act(() => {
      result.current.mutate(undefined as void);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(onSuccess).toHaveBeenCalledWith("ok");
  });

  it("calls onError callback on failure", async () => {
    const onError = vi.fn();
    const mutationFn = vi.fn(async () => {
      throw new Error("boom");
    });

    const { result } = renderHook(() =>
      useApiMutation(mutationFn, { onError })
    );

    act(() => {
      result.current.mutate(undefined as void);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0].message).toBe("boom");
  });

  it("reset clears data, error, and isLoading", async () => {
    const mutationFn = vi.fn(async () => "data");

    const { result } = renderHook(() => useApiMutation(mutationFn));

    act(() => {
      result.current.mutate(undefined as void);
    });

    await waitFor(() => expect(result.current.data).toBe("data"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores stale mutation results when a newer call is in flight", async () => {
    let resolvers: Array<(val: string) => void> = [];
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve);
        })
    );

    const { result } = renderHook(() =>
      useApiMutation<string, void>(mutationFn)
    );

    // Start two mutations
    act(() => {
      result.current.mutate(undefined as void);
    });
    act(() => {
      result.current.mutate(undefined as void);
    });

    expect(resolvers).toHaveLength(2);

    // Resolve the first (stale) one
    await act(async () => {
      resolvers[0]!("stale");
    });

    // The stale result should be ignored — data remains undefined
    expect(result.current.data).toBeUndefined();

    // Resolve the second (current) one
    await act(async () => {
      resolvers[1]!("fresh");
    });

    expect(result.current.data).toBe("fresh");
  });
});
