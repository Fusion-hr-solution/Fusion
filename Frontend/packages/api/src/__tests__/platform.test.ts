import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlatformApiClient, isBrowser } from "../platform";

// ── Setup ────────────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ data: { ok: true }, errors: [], isSuccess: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("createPlatformApiClient", () => {
  it("defaults baseUrl to /api when no env var is set", async () => {
    const api = createPlatformApiClient({ getToken: () => null });
    await api.get("/test");

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/test");
  });

  it("uses NEXT_PUBLIC_API_BASE_URL env var when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://gateway:5000/api");

    const api = createPlatformApiClient({ getToken: () => null });
    await api.get("/test");

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://gateway:5000/api/test");
  });

  it("explicit baseUrl overrides env var", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://gateway:5000/api");

    const api = createPlatformApiClient({
      baseUrl: "/custom",
      getToken: () => null,
    });
    await api.get("/test");

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/custom/test");
  });

  it("injects token from default localStorage strategy", async () => {
    // Simulate browser environment
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    const storage: Record<string, string> = { access_token: "jwt-abc" };
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
    });

    const api = createPlatformApiClient();
    await api.get("/protected");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer jwt-abc");
  });

  it("uses custom getToken when provided", async () => {
    const api = createPlatformApiClient({
      getToken: () => "custom-token",
    });
    await api.get("/protected");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer custom-token");
  });
});

// ── SSR safety ───────────────────────────────────────────────────────
// The platform client must never crash when imported or called on the
// server (Node.js / Edge), where window and localStorage don't exist.

describe("SSR safety", () => {
  it("isBrowser returns false in Node (no window/document)", () => {
    // vitest runs in Node — window, document are NOT defined by default
    // (unless previously stubbed; afterEach clears stubs)
    expect(isBrowser()).toBe(false);
  });

  it("isBrowser returns true when window and document exist", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    expect(isBrowser()).toBe(true);
  });

  it("createPlatformApiClient() does not crash on server import", () => {
    // Simply creating the client on the server must not throw
    expect(() => createPlatformApiClient()).not.toThrow();
  });

  it("server-side request proceeds without auth (no localStorage access)", async () => {
    // No window, no document, no localStorage — pure Node environment.
    // The default getToken must return null without crashing.
    const api = createPlatformApiClient();
    await api.get("/public");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("server-side request uses NEXT_PUBLIC_API_BASE_URL for absolute URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:5000/api");

    const api = createPlatformApiClient();
    await api.get("/training/courses");

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:5000/api/training/courses");
  });
});
