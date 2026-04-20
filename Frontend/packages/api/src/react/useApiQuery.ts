import { useState, useEffect, useCallback, useRef } from "react";

export interface UseApiQueryOptions {
  enabled?: boolean;
}

export interface UseApiQueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useApiQuery<T>(
  queryFn: (signal: AbortSignal) => Promise<T>,
  options?: UseApiQueryOptions
): UseApiQueryResult<T> {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoadingState, setIsLoading] = useState(enabled);
  const controllerRef = useRef<AbortController | null>(null);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const execute = useCallback(() => {
    // Abort any in-flight request
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    queryFnRef
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return; // ignore aborted requests — cleanup handles isLoading
        }
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort();
      setIsLoading(false);
      return;
    }
    execute();
    return () => {
      controllerRef.current?.abort();
    };
    // queryFn included so param changes trigger re-fetch
  }, [enabled, execute, queryFn]);

  const refetch = useCallback(() => {
    execute();
  }, [execute]);

  const isLoading =
    isLoadingState || (enabled && data === undefined && error === null);

  return { data, error, isLoading, refetch };
}
