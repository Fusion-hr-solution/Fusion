export interface ApiClientConfig {
  baseUrl?: string;
  getToken?: () => string | null;
  defaultHeaders?: Record<string, string>;
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly errors: string[],
    public readonly correlationId: string | null
  ) {
    super(errors[0] ?? `HTTP ${status} ${statusText}`);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiResponse<T> {
  data: T | null;
  errors: string[];
  isSuccess: boolean;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  skipAuth?: boolean;
}
