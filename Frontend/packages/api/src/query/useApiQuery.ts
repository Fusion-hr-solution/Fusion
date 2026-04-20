"use client";

import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useCallback } from "react";
import type { ApiQueryKey } from "./provider";

export interface UseApiQueryOptions<
  TQueryFnData,
  TData = TQueryFnData,
> extends Omit<
  UseQueryOptions<TQueryFnData, Error, TData, ApiQueryKey>,
  "queryKey" | "queryFn"
> {}

export interface UseApiQueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export function useApiQuery<TQueryFnData, TData = TQueryFnData>(
  queryKey: ApiQueryKey,
  queryFn: (signal: AbortSignal) => Promise<TQueryFnData>,
  options?: UseApiQueryOptions<TQueryFnData, TData>
): UseApiQueryResult<TData> {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const result = useQuery<TQueryFnData, Error, TData, ApiQueryKey>({
    queryKey,
    queryFn: ({ signal }) => queryFn(signal),
    ...options,
  });
  const { refetch: refetchQuery } = result;

  const refetch = useCallback(async () => {
    await refetchQuery();
  }, [refetchQuery]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    data: result.data,
    error: result.error ?? null,
    isLoading: enabled && result.isPending,
    isFetching: result.isFetching,
    refetch,
    invalidate,
  };
}
