import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  login,
  register,
  refreshToken,
  logout,
  persistAuth,
  loadAuth,
  clearAuth,
} from "../auth-service";
import {
  makeAuthResponse,
  makeSuccessResponse,
  makeErrorResponse,
  makeStoredAuth,
} from "./helpers";

// ── Global fetch mock ────────────────────────────────────────────────

const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
});

// ═════════════════════════════════════════════════════════════════════
// API functions
// ═════════════════════════════════════════════════════════════════════

describe("login", () => {
  it("sends POST to /api/identity/auth/login and returns success", async () => {
    const authRes = makeAuthResponse();
    const apiRes = makeSuccessResponse(authRes);
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve(apiRes),
    });

    const result = await login({ email: "john@example.com", password: "P@ss1" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/identity/auth/login");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({
      email: "john@example.com",
      password: "P@ss1",
    });
    expect(result.isSuccess).toBe(true);
    expect(result.data?.accessToken).toBe("access-token-123");
  });

  it("returns errors on failure", async () => {
    const apiRes = makeErrorResponse(["Invalid credentials"]);
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve(apiRes),
    });

    const result = await login({ email: "bad@example.com", password: "wrong" });

    expect(result.isSuccess).toBe(false);
    expect(result.errors).toContain("Invalid credentials");
  });
});

describe("register", () => {
  it("sends POST to /api/identity/auth/register with full payload", async () => {
    const authRes = makeAuthResponse({ fullName: "Jane Smith" });
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve(makeSuccessResponse(authRes)),
    });

    const result = await register({
      email: "jane@example.com",
      password: "Str0ng!",
      firstName: "Jane",
      lastName: "Smith",
      hireDate: "2025-01-15",
    });

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/identity/auth/register");
    const body = JSON.parse(opts.body as string);
    expect(body.firstName).toBe("Jane");
    expect(body.lastName).toBe("Smith");
    expect(result.isSuccess).toBe(true);
    expect(result.data?.fullName).toBe("Jane Smith");
  });

  it("returns errors for duplicate email", async () => {
    fetchMock.mockResolvedValueOnce({
      json: () =>
        Promise.resolve(makeErrorResponse(["Email already registered"])),
    });

    const result = await register({
      email: "dup@example.com",
      password: "P@ss1",
      firstName: "A",
      lastName: "B",
      hireDate: "2025-01-01",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.errors).toContain("Email already registered");
  });
});

describe("refreshToken", () => {
  it("sends POST with refresh token and returns new tokens", async () => {
    const newAuth = makeAuthResponse({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve(makeSuccessResponse(newAuth)),
    });

    const result = await refreshToken({ refreshToken: "old-refresh" });

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/identity/auth/refresh");
    expect(JSON.parse(opts.body as string)).toEqual({
      refreshToken: "old-refresh",
    });
    expect(result.data?.accessToken).toBe("new-access");
  });
});

describe("logout", () => {
  it("sends POST with Authorization header", async () => {
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ data: null, errors: [], isSuccess: true }),
    });

    await logout("my-token");

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/identity/auth/logout");
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer my-token",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// Token storage
// ═════════════════════════════════════════════════════════════════════

describe("persistAuth / loadAuth / clearAuth", () => {
  it("round-trips stored auth through localStorage", () => {
    const stored = makeStoredAuth();
    persistAuth(stored);

    const loaded = loadAuth();
    expect(loaded).toEqual(stored);
  });

  it("sets the ey_hr_authenticated cookie", () => {
    persistAuth(makeStoredAuth());
    expect(document.cookie).toContain("ey_hr_authenticated=true");
  });

  it("returns null when nothing is stored", () => {
    expect(loadAuth()).toBeNull();
  });

  it("returns null for corrupted JSON", () => {
    localStorage.setItem("ey_hr_auth", "NOT_JSON{{{");
    expect(loadAuth()).toBeNull();
  });

  it("clearAuth removes localStorage entry and cookie", () => {
    persistAuth(makeStoredAuth());
    clearAuth();

    expect(loadAuth()).toBeNull();
    // jsdom processes max-age=0 immediately, so the cookie is gone
    expect(document.cookie).not.toContain("ey_hr_authenticated=true");
  });
});
