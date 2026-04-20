"use client";

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

export interface ApiMutationInvalidation {
  queryKey: QueryKey;
  exact?: boolean;
}

export interface UseApiMutationOptions<TData, TArgs> extends Omit<
  UseMutationOptions<TData, Error, TArgs>,
  "mutationFn" | "onSuccess" | "onError"
> {
  onSuccess?: (data: TData, args: TArgs) => void | Promise<void>;
  onError?: (error: Error, args: TArgs) => void | Promise<void>;
  invalidateQueries?:
    | readonly ApiMutationInvalidation[]
    | ((data: TData, args: TArgs) => readonly ApiMutationInvalidation[]);
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
  options?: UseApiMutationOptions<TData, TArgs>
): UseApiMutationResult<TData, TArgs> {
  const queryClient = useQueryClient();
  const mutation = useMutation<TData, Error, TArgs>({
    mutationFn,
    ...options,
    onSuccess: async (data, args, context) => {
      const invalidations =
        typeof options?.invalidateQueries === "function"
          ? options.invalidateQueries(data, args)
          : options?.invalidateQueries;

      if (invalidations && invalidations.length > 0) {
        invalidations.forEach((invalidation) => {
          void queryClient.invalidateQueries({
            queryKey: invalidation.queryKey,
            exact: invalidation.exact,
          });
        });
      }

      await options?.onSuccess?.(data, args);
    },
    onError: async (error, args, _context) => {
      await options?.onError?.(error, args);
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    data: mutation.data,
    error: mutation.error ?? null,
    isLoading: mutation.isPending,
    reset: mutation.reset,
  };
}
