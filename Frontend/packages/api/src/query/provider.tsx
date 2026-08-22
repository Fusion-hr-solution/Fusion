"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
  type DefaultOptions,
  type QueryClientConfig,
  type QueryKey,
} from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { classifyApiError, isRetriableErrorKind } from "../error-classification";

/**
 * Error-class-aware, bounded retry. Only transient classes (upstream-unavailable,
 * network) retry, and at most once — validation/business and auth failures are
 * never retried, and no configuration can produce a retry storm. This is a shared
 * correctness policy: it applies to every consumer and does not change caching.
 */
function shouldRetryRequest(failureCount: number, error: unknown) {
  if (failureCount >= 1) {
    return false;
  }
  return isRetriableErrorKind(classifyApiError(error));
}

/**
 * The raw QueryClient baseline shared by every consumer. Intentionally keeps
 * `staleTime: 0` so adopting the error-class-aware retry does not silently change
 * the caching/revalidation semantics any existing consumer relies on. Modules that
 * want stale-while-revalidate opt into {@link SHARED_QUERY_DEFAULTS} explicitly.
 */
export function createApiQueryDefaultOptions(): DefaultOptions {
  return {
    queries: {
      retry: shouldRetryRequest,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 0,
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: false,
    },
  };
}

/**
 * Opt-in shared baseline for a workspace module: volatility-appropriate
 * stale-while-revalidate with previous data retained during background refresh, so
 * revisiting a surface renders cached data instantly instead of a skeleton. A module
 * passes this as `queryClientConfig`; correctness-sensitive reads still override
 * `staleTime`/invalidate per query. Exposed as a configurable default rather than
 * mutated into the raw baseline, so unrelated consumers are never changed silently.
 */
export const SHARED_QUERY_DEFAULTS: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      placeholderData: keepPreviousData,
    },
  },
};

export function createApiQueryClient(config?: QueryClientConfig) {
  const defaultOptions = createApiQueryDefaultOptions();

  return new QueryClient({
    ...config,
    defaultOptions: {
      ...defaultOptions,
      ...config?.defaultOptions,
      queries: {
        ...defaultOptions.queries,
        ...config?.defaultOptions?.queries,
      },
      mutations: {
        ...defaultOptions.mutations,
        ...config?.defaultOptions?.mutations,
      },
    },
  });
}

export interface ApiQueryProviderProps extends PropsWithChildren {
  client?: QueryClient;
  queryClientConfig?: QueryClientConfig;
}

export function ApiQueryProvider({
  children,
  client,
  queryClientConfig,
}: ApiQueryProviderProps) {
  const [queryClient] = useState(
    () => client ?? createApiQueryClient(queryClientConfig)
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export type ApiQueryKey = QueryKey;

export const useApiQueryClient = useQueryClient;
