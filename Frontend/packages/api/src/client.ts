import { ApiError } from "./types";
import type {
  ApiClient,
  ApiClientConfig,
  ApiResponse,
  RequestOptions,
} from "./types";

const DEFAULT_BASE_URL = "/api";

/**
 * Extracts a flat string[] of error messages from either:
 *  - Platform envelope: { errors: string[] }
 *  - ASP.NET ProblemDetails: { errors: Record<string, string[]>, title?: string }
 *
 * Falls back to statusText when nothing useful is found.
 */
function extractErrors(
  json: Record<string, unknown>,
  statusText: string
): string[] {
  const errors = json.errors;

  // Platform envelope — errors is already string[]
  if (Array.isArray(errors) && errors.length > 0) {
    return errors as string[];
  }

  // ASP.NET ProblemDetails — errors is Record<string, string[]>
  if (errors !== null && typeof errors === "object" && !Array.isArray(errors)) {
    const messages = Object.values(errors as Record<string, string[]>).flat();
    if (messages.length > 0) return messages;
  }

  // ProblemDetails with title but no errors map (e.g. 404 ProblemDetails)
  if (typeof json.title === "string" && json.title.length > 0) {
    return [json.title];
  }

  return [statusText];
}

export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  function throwApiError(error: ApiError): never {
    if (error.status === 401 && config.onAuthError) {
      config.onAuthError(error);
    }
    throw error;
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const normalizedBase = baseUrl.endsWith("/")
      ? baseUrl.slice(0, -1)
      : baseUrl;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    let url = `${normalizedBase}${normalizedPath}`;

    if (options?.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value != null) searchParams.append(key, String(value));
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

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

    if (
      headers["X-Correlation-Id"] == null &&
      typeof crypto !== "undefined" &&
      crypto.randomUUID
    ) {
      headers["X-Correlation-Id"] = crypto.randomUUID();
    }

    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;

    if (body !== undefined && !isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body:
        body !== undefined
          ? isFormData
            ? (body as FormData)
            : JSON.stringify(body)
          : undefined,
      credentials: options?.credentials ?? "same-origin",
      signal: options?.signal,
    });

    const correlationId = res.headers.get("X-Correlation-Id");
    const rtype = options?.responseType ?? "json";

    // ── Non-JSON response types (blob, text, arrayBuffer) ─────────
    if (rtype !== "json") {
      if (!res.ok) {
        // Try to extract error details from a JSON body, fall back to statusText.
        let errors: string[] = [res.statusText];
        try {
          const errJson = (await res.json()) as Record<string, unknown>;
          errors = extractErrors(errJson, res.statusText);
        } catch {
          // body wasn't JSON — keep the default
        }
        throwApiError(
          new ApiError(res.status, res.statusText, errors, correlationId)
        );
      }
      const body = await res[rtype]();
      return body as T;
    }

    // ── JSON envelope handling ────────────────────────────────────
    const isEmpty =
      res.status === 204 || res.headers.get("Content-Length") === "0";
    if (isEmpty) {
      if (res.ok) return undefined as T;
      throwApiError(
        new ApiError(
          res.status,
          res.statusText,
          [res.statusText],
          correlationId
        )
      );
    }

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
      throwApiError(
        new ApiError(
          res.status,
          res.statusText,
          ["Response is not valid JSON"],
          correlationId
        )
      );
    }

    if (!res.ok || !json.isSuccess) {
      throwApiError(
        new ApiError(
          res.status,
          res.statusText,
          extractErrors(
            json as unknown as Record<string, unknown>,
            res.statusText
          ),
          correlationId
        )
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
