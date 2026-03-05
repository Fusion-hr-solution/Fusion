import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlatformApiClient } from "../platform";

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
