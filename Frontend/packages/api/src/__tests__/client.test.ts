import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApiClient } from "../client";
import { ApiError } from "../types";

// ── Test helpers ─────────────────────────────────────────────────────
// These helpers build fake fetch() responses so we can test the client
// without making real network requests.

// Simulates a standard backend response with a JSON body.
// The backend always wraps responses in { data, errors, isSuccess }.
function jsonResponse(
  body: unknown,
  init?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  }
): Response {
  const status = init?.status ?? 200;
  const headers = new Headers({
    "Content-Type": "application/json",
    ...init?.headers,
  });

  return new Response(JSON.stringify(body), {
    status,
    statusText: init?.statusText ?? "OK",
    headers,
  });
}

// Simulates a response with no body (e.g. DELETE returning 204, or a logout endpoint).
// Content-Length: 0 tells the client there's nothing to parse.
function emptyResponse(status = 204): Response {
  return new Response(null, {
    status,
    statusText: status === 204 ? "No Content" : "",
    headers: new Headers({ "Content-Length": "0" }),
  });
}

// ── Setup ────────────────────────────────────────────────────────────
// We replace the global fetch() with a spy before each test so we can
// control what the "server" returns and assert what the client sent.

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("createApiClient", () => {
  // ── Successful requests ────────────────────────────────────────

  describe("successful requests", () => {
    it("GET unwraps ApiResponse envelope and returns data", async () => {
      const courses = [{ id: 1, title: "TypeScript" }];
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: courses, errors: [], isSuccess: true })
      );

      const api = createApiClient({ baseUrl: "/api" });
      const result = await api.get("/training/courses");

      expect(result).toEqual(courses);
      expect(fetchSpy).toHaveBeenCalledOnce();

      // Verify the actual fetch call
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/training/courses");
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
    });

    it("POST sends JSON body and returns unwrapped data", async () => {
      const created = { id: 5, title: "New Course" };
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: created, errors: [], isSuccess: true })
      );

      const api = createApiClient({ baseUrl: "/api" });
      const result = await api.post("/training/courses", {
        title: "New Course",
      });

      expect(result).toEqual(created);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ title: "New Course" }));

      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("PUT sends body with correct method", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: null, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.put("/items/1", { name: "Updated" });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("PUT");
    });

    it("PATCH sends body with correct method", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: null, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.patch("/items/1", { name: "Patched" });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("PATCH");
    });

    it("DELETE sends request with no body", async () => {
      fetchSpy.mockResolvedValueOnce(emptyResponse(204));

      const api = createApiClient();
      const result = await api.delete("/items/1");

      expect(result).toBeUndefined();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("DELETE");
      expect(init.body).toBeUndefined();
    });
  });

  // ── Empty responses ────────────────────────────────────────────
  // The client must return undefined for empty bodies without crashing on JSON.parse.
  // Critically, this early-return only applies to SUCCESSFUL empty responses —
  // a 404 with an empty body must still throw ApiError, not silently return undefined.

  describe("empty responses", () => {
    it("returns undefined for 204 No Content", async () => {
      fetchSpy.mockResolvedValueOnce(emptyResponse(204));

      const api = createApiClient();
      const result = await api.delete("/items/1");

      expect(result).toBeUndefined();
    });

    it("returns undefined when Content-Length is 0", async () => {
      fetchSpy.mockResolvedValueOnce(emptyResponse(200));

      const api = createApiClient();
      const result = await api.post("/logout");

      expect(result).toBeUndefined();
    });

    it("throws ApiError on non-ok response with empty body (e.g. 404 with no body)", async () => {
      // Simulates a gateway 404 that returns no body — must NOT silently return undefined
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          statusText: "Not Found",
          headers: new Headers({ "Content-Length": "0" }),
        })
      );

      const api = createApiClient();
      const err = await api.get("/missing").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
    });
  });

  // ── Authorization header ───────────────────────────────────────
  // getToken is called on every request (not cached at client creation time).
  // This matters because tokens expire — stale closure bugs would send old tokens.

  describe("authorization header", () => {
    it("attaches Bearer token from getToken callback", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient({
        getToken: () => "my-jwt-token",
      });
      await api.get("/protected");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer my-jwt-token");
    });

    it("omits Authorization when getToken returns null", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient({
        getToken: () => null,
      });
      await api.get("/public");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("omits Authorization when no getToken is configured", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient(); // no getToken at all
      await api.get("/public");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("skips auth when skipAuth option is set", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient({
        getToken: () => "my-jwt-token",
      });
      await api.get("/public", { skipAuth: true });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("calls getToken on every request (no stale closure)", async () => {
      // This test proves getToken is called at request time, not config time.
      // If someone refactors to cache the token at createApiClient() time,
      // this test fails — catching a real bug.
      let callCount = 0;
      const getToken = () => {
        callCount++;
        return `token-${callCount}`;
      };

      fetchSpy.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: {}, errors: [], isSuccess: true }))
      );
      const api = createApiClient({ getToken });

      await api.get("/first");
      await api.get("/second");

      const headers1 = (fetchSpy.mock.calls[0] as [string, RequestInit])[1]
        .headers as Record<string, string>;
      const headers2 = (fetchSpy.mock.calls[1] as [string, RequestInit])[1]
        .headers as Record<string, string>;

      expect(headers1["Authorization"]).toBe("Bearer token-1");
      expect(headers2["Authorization"]).toBe("Bearer token-2");
    });
  });

  // ── Error handling ─────────────────────────────────────────────
  // All API failures must throw ApiError. The backend can signal failure two ways:
  //   1. A non-2xx HTTP status (e.g. 401, 404, 500)
  //   2. HTTP 200 with isSuccess: false (e.g. validation errors)
  // Both must result in ApiError being thrown.

  describe("error handling", () => {
    it("throws ApiError on non-2xx response", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          { data: null, errors: ["Unauthorized"], isSuccess: false },
          { status: 401, statusText: "Unauthorized" }
        )
      );

      const api = createApiClient();

      const err = await api.get("/protected").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);

      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.statusText).toBe("Unauthorized");
      expect(apiErr.errors).toEqual(["Unauthorized"]);
      expect(apiErr.name).toBe("ApiError");
      expect(apiErr.message).toBe("Unauthorized");
    });

    it("throws ApiError when isSuccess is false even on HTTP 200", async () => {
      // The backend can return 200 with isSuccess: false for validation errors.
      // Our client must treat this as a failure.
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          data: null,
          errors: ["Validation failed"],
          isSuccess: false,
        })
      );

      const api = createApiClient();

      const err = await api
        .post("/items", { bad: "data" })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);

      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(200);
      expect(apiErr.errors).toEqual(["Validation failed"]);
    });

    it("falls back to statusText when errors array is empty", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          { data: null, errors: [], isSuccess: false },
          { status: 500, statusText: "Internal Server Error" }
        )
      );

      const api = createApiClient();

      const err = await api.get("/broken").catch((e: unknown) => e);
      const apiErr = err as ApiError;
      expect(apiErr.errors).toEqual(["Internal Server Error"]);
      expect(apiErr.message).toBe("Internal Server Error");
    });

    it("throws ApiError on non-JSON response body", async () => {
      // Happens when a proxy returns HTML error pages, nginx 502, etc.
      fetchSpy.mockResolvedValueOnce(
        new Response("<html>Bad Gateway</html>", {
          status: 502,
          statusText: "Bad Gateway",
          headers: new Headers({ "Content-Type": "text/html" }),
        })
      );

      const api = createApiClient();

      const err = await api.get("/down").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);

      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(502);
      expect(apiErr.errors).toEqual(["Response is not valid JSON"]);
    });

    it("includes correlationId from response header in ApiError", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          { data: null, errors: ["Server error"], isSuccess: false },
          {
            status: 500,
            statusText: "Internal Server Error",
            headers: { "X-Correlation-Id": "abc-123-def" },
          }
        )
      );

      const api = createApiClient();

      const err = await api.get("/broken").catch((e: unknown) => e);
      const apiErr = err as ApiError;
      expect(apiErr.correlationId).toBe("abc-123-def");
    });

    it("extracts errors from ASP.NET ProblemDetails validation format", async () => {
      // ASP.NET model validation returns errors as Record<string, string[]>,
      // not string[]. The client must flatten them into ApiError.errors.
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          {
            type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            title: "One or more validation errors occurred.",
            status: 400,
            errors: {
              Email: [
                "The Email field is required.",
                "The Email field is not a valid e-mail address.",
              ],
              Password: ["The Password field is required."],
            },
            traceId: "00-abc-def-00",
          },
          { status: 400, statusText: "Bad Request" }
        )
      );

      const api = createApiClient();
      const err = await api
        .post("/identity/auth/login", { email: "", password: "" })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.errors).toEqual([
        "The Email field is required.",
        "The Email field is not a valid e-mail address.",
        "The Password field is required.",
      ]);
      expect(apiErr.message).toBe("The Email field is required.");
    });

    it("uses ProblemDetails title when errors map is empty", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          {
            type: "https://tools.ietf.org/html/rfc9110#section-15.5.4",
            title: "Not Found",
            status: 404,
            errors: {},
          },
          { status: 404, statusText: "Not Found" }
        )
      );

      const api = createApiClient();
      const err = await api.get("/missing").catch((e: unknown) => e);
      const apiErr = err as ApiError;
      expect(apiErr.errors).toEqual(["Not Found"]);
    });
  });

  // ── Headers ────────────────────────────────────────────────────
  // Every request automatically gets Accept, X-Correlation-Id, and (if a body
  // is present) Content-Type. Per-request headers override config defaults.

  describe("headers", () => {
    it("sends X-Correlation-Id on every request", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/test");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["X-Correlation-Id"]).toBeDefined();
      expect(headers["X-Correlation-Id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("merges defaultHeaders from config", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient({
        defaultHeaders: { "X-Custom": "value" },
      });
      await api.get("/test");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["X-Custom"]).toBe("value");
    });

    it("per-request headers override defaultHeaders", async () => {
      // Spread order in client.ts: { ...config.defaultHeaders, ...options?.headers }
      // Later spread wins — per-request should override config defaults
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient({
        defaultHeaders: { "X-Custom": "default" },
      });
      await api.get("/test", { headers: { "X-Custom": "override" } });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["X-Custom"]).toBe("override");
    });

    it("sets Accept: application/json on all requests", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/test");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/json");
    });

    it("does NOT set Content-Type on GET (no body)", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/test");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });

    it("sets Content-Type: application/json on POST with body", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.post("/test", { foo: "bar" });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  // ── Configuration ──────────────────────────────────────────────

  describe("configuration", () => {
    it("uses /api as default baseUrl", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient(); // no config
      await api.get("/test");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/test");
    });

    it("uses custom baseUrl when provided", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient({ baseUrl: "http://localhost:5000/api" });
      await api.get("/training/courses");

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:5000/api/training/courses");
    });

    it("passes credentials option to fetch", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/test", { credentials: "include" });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.credentials).toBe("include");
    });

    it("defaults credentials to same-origin", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/test");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.credentials).toBe("same-origin");
    });

    it("passes abort signal to fetch", async () => {
      const controller = new AbortController();
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/test", { signal: controller.signal });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBe(controller.signal);
    });
  });

  // ── Network & abort errors ─────────────────────────────────────
  // These errors must propagate as-is — NOT wrapped in ApiError.
  // Callers distinguish them with instanceof:
  //   TypeError    → offline / DNS failure (fetch never got a response)
  //   DOMException → request was cancelled via AbortController
  // Wrapping them in ApiError would make it impossible to tell the difference.

  describe("network and abort errors", () => {
    it("propagates TypeError on network failure (not wrapped in ApiError)", async () => {
      const networkError = new TypeError("Failed to fetch");
      fetchSpy.mockRejectedValueOnce(networkError);

      const api = createApiClient();
      const err = await api.get("/offline").catch((e: unknown) => e);

      expect(err).toBe(networkError);
      expect(err).toBeInstanceOf(TypeError);
      expect(err).not.toBeInstanceOf(ApiError);
    });

    it("propagates AbortError when request is cancelled", async () => {
      const controller = new AbortController();
      const abortError = new DOMException(
        "The operation was aborted.",
        "AbortError"
      );
      fetchSpy.mockRejectedValueOnce(abortError);

      const api = createApiClient();
      const err = await api
        .get("/slow", { signal: controller.signal })
        .catch((e: unknown) => e);

      expect(err).toBe(abortError);
      expect(err).toBeInstanceOf(DOMException);
      expect(err).not.toBeInstanceOf(ApiError);
    });

    it("propagates AbortError during json() parsing (not swallowed as invalid JSON)", async () => {
      // Simulate: fetch resolves, but abort fires while reading the body
      const abortError = new DOMException(
        "The operation was aborted.",
        "AbortError"
      );
      const fakeResponse = new Response("not used", {
        status: 200,
        statusText: "OK",
      });
      // Override json() to throw AbortError
      vi.spyOn(fakeResponse, "json").mockRejectedValueOnce(abortError);
      fetchSpy.mockResolvedValueOnce(fakeResponse);

      const api = createApiClient();
      const err = await api.get("/mid-abort").catch((e: unknown) => e);

      expect(err).toBe(abortError);
      expect(err).toBeInstanceOf(DOMException);
      expect(err).not.toBeInstanceOf(ApiError);
    });

    it("propagates error when getToken throws", async () => {
      const tokenError = new Error("Token storage unavailable");
      const api = createApiClient({
        getToken: () => {
          throw tokenError;
        },
      });

      const err = await api.get("/protected").catch((e: unknown) => e);
      expect(err).toBe(tokenError);
    });
  });

  // ── Correlation IDs ────────────────────────────────────────────
  // Each request gets a unique X-Correlation-Id UUID. The backend stamps this
  // on its logs so you can trace a specific request end-to-end. Two concurrent
  // requests must never share the same ID — that would make tracing useless.

  describe("correlation IDs", () => {
    it("generates independent correlation IDs for concurrent requests", async () => {
      fetchSpy.mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: {}, errors: [], isSuccess: true }))
      );

      const api = createApiClient();
      await Promise.all([api.get("/a"), api.get("/b")]);

      const id1 = (fetchSpy.mock.calls[0] as [string, RequestInit])[1]
        .headers as Record<string, string>;
      const id2 = (fetchSpy.mock.calls[1] as [string, RequestInit])[1]
        .headers as Record<string, string>;

      expect(id1["X-Correlation-Id"]).toBeDefined();
      expect(id2["X-Correlation-Id"]).toBeDefined();
      expect(id1["X-Correlation-Id"]).not.toBe(id2["X-Correlation-Id"]);
    });
  });

  // ── Body handling ─────────────────────────────────────────────
  // POST/PUT/PATCH with no body should behave like GET — no Content-Type header
  // and no body in the fetch call. Sending Content-Type: application/json with
  // no body confuses some servers.

  describe("body handling", () => {
    it("POST with undefined body sends no Content-Type and no body", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: {}, errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.post("/action");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
      expect(init.body).toBeUndefined();
    });

    it("POST with FormData body does not set Content-Type and does not stringify", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: { id: 1 }, errors: [], isSuccess: true })
      );

      const form = new FormData();
      form.append("file", new Blob(["hello"]), "hello.txt");

      const api = createApiClient();
      const result = await api.post<{ id: number }>("/upload", form);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      // Content-Type must NOT be set — the browser sets multipart/form-data with boundary
      expect(headers["Content-Type"]).toBeUndefined();
      // Body must be the FormData instance, not a JSON string
      expect(init.body).toBe(form);
      expect(result).toEqual({ id: 1 });
    });
  });

  // ── Query params ──────────────────────────────────────────────
  describe("query params", () => {
    it("appends params to the URL as a query string", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: [], errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/items", { params: { page: 2, search: "foo" } });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/items?page=2&search=foo");
    });

    it("filters out undefined and null param values", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: [], errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/items", {
        params: { page: 1, search: undefined, tag: null, active: true },
      });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/items?page=1&active=true");
    });

    it("omits query string when all param values are undefined/null", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ data: [], errors: [], isSuccess: true })
      );

      const api = createApiClient();
      await api.get("/items", { params: { search: undefined } });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/items");
    });
  });

  // ── Non-JSON response types ───────────────────────────────────
  describe("responseType", () => {
    it("responseType 'blob' returns blob without envelope unwrapping", async () => {
      const blobContent = new Blob(["file-content"], {
        type: "application/pdf",
      });
      fetchSpy.mockResolvedValueOnce(
        new Response(blobContent, { status: 200, statusText: "OK" })
      );

      const api = createApiClient();
      const result = await api.get<Blob>("/files/1", {
        responseType: "blob",
      });

      expect(result).toBeInstanceOf(Blob);
    });

    it("responseType 'text' returns raw text without envelope unwrapping", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("plain text", { status: 200, statusText: "OK" })
      );

      const api = createApiClient();
      const result = await api.get<string>("/export/csv", {
        responseType: "text",
      });

      expect(result).toBe("plain text");
    });

    it("responseType 'blob' throws ApiError on non-OK and tries JSON error extraction", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: ["Not found"] }), {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json" },
        })
      );

      const api = createApiClient();
      await expect(
        api.get("/files/999", { responseType: "blob" })
      ).rejects.toThrow(ApiError);

      try {
        await api.get("/files/999", { responseType: "blob" });
      } catch (err) {
        // fetchSpy was only set up once, so we test the first rejection
      }
    });

    it("responseType 'blob' throws ApiError with statusText when error body is not JSON", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("server error", {
          status: 500,
          statusText: "Internal Server Error",
        })
      );

      const api = createApiClient();
      try {
        await api.get("/files/1", { responseType: "blob" });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(500);
        expect((err as ApiError).errors).toEqual(["Internal Server Error"]);
      }
    });
  });

  // ── onAuthError callback ──────────────────────────────────────
  describe("onAuthError", () => {
    it("calls onAuthError on 401 before throwing ApiError", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          { data: null, errors: ["Unauthorized"], isSuccess: false },
          { status: 401, statusText: "Unauthorized" }
        )
      );

      const onAuthError = vi.fn();
      const api = createApiClient({ onAuthError });

      await expect(api.get("/protected")).rejects.toThrow(ApiError);
      expect(onAuthError).toHaveBeenCalledOnce();
      expect(onAuthError.mock.calls[0]![0]).toBeInstanceOf(ApiError);
      expect(onAuthError.mock.calls[0]![0].status).toBe(401);
    });

    it("does not call onAuthError on non-401 errors", async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          { data: null, errors: ["Forbidden"], isSuccess: false },
          { status: 403, statusText: "Forbidden" }
        )
      );

      const onAuthError = vi.fn();
      const api = createApiClient({ onAuthError });

      await expect(api.get("/admin")).rejects.toThrow(ApiError);
      expect(onAuthError).not.toHaveBeenCalled();
    });

    it("calls onAuthError on 401 even for non-JSON responseType", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: ["Token expired"] }), {
          status: 401,
          statusText: "Unauthorized",
          headers: { "Content-Type": "application/json" },
        })
      );

      const onAuthError = vi.fn();
      const api = createApiClient({ onAuthError });

      await expect(
        api.get("/files/1", { responseType: "blob" })
      ).rejects.toThrow(ApiError);
      expect(onAuthError).toHaveBeenCalledOnce();
    });
  });
});
