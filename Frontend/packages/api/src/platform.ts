import { createApiClient } from "./client";
import type { ApiClient } from "./types";

declare const process: { env?: Record<string, string | undefined> } | undefined;

export interface PlatformApiClientConfig {
  // Override the base URL (default: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api")
  baseUrl?: string;
  // Token retrieval function (default: reads access_token from localStorage)
  getToken?: () => string | null;
}

export function createPlatformApiClient(
  config: PlatformApiClientConfig = {}
): ApiClient {
  const baseUrl =
    config.baseUrl ??
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL
      ? process.env.NEXT_PUBLIC_API_BASE_URL
      : "/api");

  const getToken =
    config.getToken ??
    (() => {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem("access_token");
      }
      return null;
    });

  return createApiClient({ baseUrl, getToken });
}
