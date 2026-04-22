// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { ApiError } from "../types";
import {
  ApiQueryProvider,
  createApiQueryClient,
  createApiQueryDefaultOptions,
  useApiMutation,
  useApiQuery,
} from "../query";

function createWrapper() {
  const client = createApiQueryClient();

  return {
    client,
    wrapper: ({ children }: PropsWithChildren) =>
      createElement(ApiQueryProvider, { client }, children),
  };
}

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("query layer", () => {
  it("uses conservative default query and mutation behavior", () => {
    const defaults = createApiQueryDefaultOptions();
    const queryRetry = defaults.queries?.retry;

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
    expect(typeof queryRetry).toBe("function");
    expect(
      (queryRetry as (failureCount: number, error: unknown) => boolean)(
        0,
        new ApiError(400, "Bad Request", ["invalid"], null)
      )
    ).toBe(false);
    expect(
      (queryRetry as (failureCount: number, error: unknown) => boolean)(
        0,
        new ApiError(500, "Server Error", ["down"], null)
      )
    ).toBe(true);
    expect(
      (queryRetry as (failureCount: number, error: unknown) => boolean)(
        1,
        new Error("retry budget spent")
      )
    ).toBe(false);
  });

  it("invalidates configured query keys after a mutation succeeds", async () => {
    const fetchValue = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    const mutateValue = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue("done");
    const { wrapper } = createWrapper();

    const queryHook = renderHook(
      () => useApiQuery(["example"], () => fetchValue()),
      { wrapper }
    );

    await waitFor(() => expect(queryHook.result.current.data).toBe("first"));

    const mutationHook = renderHook(
      () =>
        useApiMutation(mutateValue, {
          invalidateQueries: [{ queryKey: ["example"] }],
        }),
      { wrapper }
    );

    await act(async () => {
      await mutationHook.result.current.mutateAsync(undefined as void);
    });

    await waitFor(() => expect(fetchValue).toHaveBeenCalledTimes(2));
    expect(queryHook.result.current.data).toBe("second");
  });

  it("waits for invalidations to finish before calling onSuccess", async () => {
    const deferred = createDeferredPromise<string>();
    const fetchValue = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockImplementationOnce(() => deferred.promise);
    const mutateValue = vi.fn<() => Promise<string>>().mockResolvedValue("done");
    const onSuccess = vi.fn();
    const { wrapper } = createWrapper();

    renderHook(() => useApiQuery(["example"], () => fetchValue()), {
      wrapper,
    });

    await waitFor(() => expect(fetchValue).toHaveBeenCalledTimes(1));

    const mutationHook = renderHook(
      () =>
        useApiMutation(mutateValue, {
          invalidateQueries: [{ queryKey: ["example"] }],
          onSuccess,
        }),
      { wrapper }
    );

    const mutationPromise = mutationHook.result.current.mutateAsync(undefined as void);

    await Promise.resolve();
    expect(onSuccess).not.toHaveBeenCalled();

    deferred.resolve("second");

    await act(async () => {
      await mutationPromise;
    });

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
