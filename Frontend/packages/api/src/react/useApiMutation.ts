import { useState, useCallback, useRef } from "react";

export interface UseApiMutationOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export interface UseApiMutationResult<TData, TArgs> {
  mutate: (args: TArgs) => void;
  mutateAsync: (args: TArgs) => Promise<TData>;
  data: TData | undefined;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

export function useApiMutation<TData, TArgs = void>(
  mutationFn: (args: TArgs) => Promise<TData>,
  options?: UseApiMutationOptions<TData>
): UseApiMutationResult<TData, TArgs> {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const callIdRef = useRef(0);
  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutateAsync = useCallback(async (args: TArgs): Promise<TData> => {
    const id = ++callIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await mutationFnRef.current(args);
      if (callIdRef.current === id) {
        setData(result);
        setIsLoading(false);
        optionsRef.current?.onSuccess?.(result);
      }
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (callIdRef.current === id) {
        setError(error);
        setIsLoading(false);
        optionsRef.current?.onError?.(error);
      }
      throw error;
    }
  }, []);

  const mutate = useCallback(
    (args: TArgs) => {
      mutateAsync(args).catch(() => {
        // error is already captured in state and onError callback
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, mutateAsync, data, error, isLoading, reset };
}
