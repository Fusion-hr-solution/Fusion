export interface ApiClientConfig {
  baseUrl?: string; // Prefixed to every path, Default: "/api"
  getToken?: () => string | null; // Called per-request. Null = no auth header.
  defaultHeaders?: Record<string, string>; // Merged into every request.
  onAuthError?: (error: ApiError) => void; // Called once on the first 401 response. The error is still thrown.
}

// Returned by createApiClient(). Reference this type when passing the client as a parameter or storing it in context.
export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}

// Thrown on any failed API response. Network/abort errors are NOT wrapped here
// — they propagate as TypeError and DOMException respectively.
export class ApiError extends Error {
  constructor(
    public readonly status: number, // e.g. 401, 404, 500
    public readonly statusText: string, // e.g. "Unauthorized"
    public readonly errors: string[], // Messages from the backend
    public readonly correlationId: string | null // For tracing — include in bug reports
  ) {
    super(errors[0] ?? `HTTP ${status} ${statusText}`);
    this.name = "ApiError";
    // Needed for instanceof to work correctly across monorepo packages.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Backend response envelope. The client unwraps this — callers get data directly.
export interface ApiResponse<T> {
  data: T | null;
  errors: string[];
  isSuccess: boolean;
}

// Per-request overrides, passed as the last argument to any client method.
export interface RequestOptions {
  headers?: Record<string, string>; // Merged over defaultHeaders for this request.
  credentials?: RequestCredentials; // Default: "same-origin".
  signal?: AbortSignal; // For cancellation via AbortController.
  skipAuth?: boolean; // Omit the Authorization header (e.g. login endpoint).
  params?: Record<string, string | number | boolean | undefined | null>; // Appended as query string. undefined/null values are filtered out.
  responseType?: "json" | "blob" | "text" | "arrayBuffer"; // Default: "json". Non-JSON types skip envelope unwrapping.
}
