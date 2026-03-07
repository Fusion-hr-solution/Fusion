import { ApiError } from "./types";
import type {
  ApiClient,
  ApiClientConfig,
  ApiResponse,
  RequestOptions,
} from "./types";

const DEFAULT_BASE_URL = "/api";

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...config.defaultHeaders,
      ...options?.headers,
    };

    if (!options?.skipAuth && config.getToken) {
      const token = config.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      headers["X-Correlation-Id"] = crypto.randomUUID();
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: options?.credentials ?? "same-origin",
      signal: options?.signal,
    });

    if (
      res.ok &&
      (res.status === 204 || res.headers.get("Content-Length") === "0")
    ) {
      return undefined as T;
    }

    const correlationId = res.headers.get("X-Correlation-Id");

    let json: ApiResponse<T>;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch (parseError) {
      // Don't swallow abort or network errors as "invalid JSON"
      if (
        parseError instanceof DOMException ||
        parseError instanceof TypeError
      ) {
        throw parseError;
      }
      throw new ApiError(
        res.status,
        res.statusText,
        ["Response is not valid JSON"],
        correlationId
      );
    }

    if (!res.ok || !json.isSuccess) {
      throw new ApiError(
        res.status,
        res.statusText,
        json.errors?.length ? json.errors : [res.statusText],
        correlationId
      );
    }

    return json.data as T;
  }

  return {
    get<T>(path: string, options?: RequestOptions): Promise<T> {
      return request<T>("GET", path, undefined, options);
    },

    post<T>(
      path: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<T> {
      return request<T>("POST", path, body, options);
    },

    put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
      return request<T>("PUT", path, body, options);
    },

    patch<T>(
      path: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<T> {
      return request<T>("PATCH", path, body, options);
    },

    delete<T>(path: string, options?: RequestOptions): Promise<T> {
      return request<T>("DELETE", path, undefined, options);
    },
  };
}
