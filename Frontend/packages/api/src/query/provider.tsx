"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
  type DefaultOptions,
  type QueryClientConfig,
  type QueryKey,
} from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { ApiError } from "../types";

function shouldRetryRequest(failureCount: number, error: unknown) {
  if (failureCount >= 1) {
    return false;
  }

  if (error instanceof ApiError) {
    return error.status >= 500;
  }

  return true;
}

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

export function createApiQueryClient(config?: QueryClientConfig) {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...createApiQueryDefaultOptions(),
      ...config?.defaultOptions,
      queries: {
        ...createApiQueryDefaultOptions().queries,
        ...config?.defaultOptions?.queries,
      },
      mutations: {
        ...createApiQueryDefaultOptions().mutations,
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
