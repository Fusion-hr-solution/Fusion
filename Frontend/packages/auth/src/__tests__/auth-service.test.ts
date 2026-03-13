import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@repo/api";
import type { ApiClient } from "@repo/api";
import {
  login,
  register,
  refreshToken,
  logout,
  persistAuth,
  loadAuth,
  clearAuth,
} from "../auth-service";
import { makeAuthResponse, makeApiError, makeStoredAuth } from "./helpers";

// ── Mock the API client returned by createPlatformApiClient ──────────

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual<typeof import("@repo/api")>("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ post: mockPost }) as unknown as ApiClient,
  };
});

beforeEach(() => {
  mockPost.mockReset();
});

// ═════════════════════════════════════════════════════════════════════
// API functions
// ═════════════════════════════════════════════════════════════════════

describe("login", () => {
  it("calls POST /identity/auth/login and returns AuthResponse", async () => {
    const authRes = makeAuthResponse();
    mockPost.mockResolvedValueOnce(authRes);

    const result = await login({
      email: "john@example.com",
      password: "P@ss1",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/auth/login",
      {
        email: "john@example.com",
        password: "P@ss1",
      },
      { skipAuth: true }
    );
    expect(result.accessToken).toBe("access-token-123");
  });

  it("throws ApiError on failure", async () => {
    mockPost.mockRejectedValueOnce(makeApiError(["Invalid credentials"], 401));

    await expect(
      login({ email: "bad@example.com", password: "wrong" })
    ).rejects.toThrow(ApiError);
  });
});

describe("register", () => {
  it("calls POST /identity/auth/register and returns AuthResponse", async () => {
    const authRes = makeAuthResponse({ fullName: "Jane Smith" });
    mockPost.mockResolvedValueOnce(authRes);

    const result = await register({
      email: "jane@example.com",
      password: "Str0ng!",
      firstName: "Jane",
      lastName: "Smith",
      hireDate: "2025-01-15",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/auth/register",
      {
        email: "jane@example.com",
        password: "Str0ng!",
        firstName: "Jane",
        lastName: "Smith",
        hireDate: "2025-01-15",
      },
      { skipAuth: true }
    );
    expect(result.fullName).toBe("Jane Smith");
  });

  it("throws ApiError for duplicate email", async () => {
    mockPost.mockRejectedValueOnce(makeApiError(["Email already registered"]));

    await expect(
      register({
        email: "dup@example.com",
        password: "P@ss1",
        firstName: "A",
        lastName: "B",
        hireDate: "2025-01-01",
      })
    ).rejects.toThrow(ApiError);
  });
});

describe("refreshToken", () => {
  it("calls POST /identity/auth/refresh and returns new tokens", async () => {
    const newAuth = makeAuthResponse({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    mockPost.mockResolvedValueOnce(newAuth);

    const result = await refreshToken({ refreshToken: "old-refresh" });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/auth/refresh",
      { refreshToken: "old-refresh" },
      { skipAuth: true }
    );
    expect(result.accessToken).toBe("new-access");
  });
});

describe("logout", () => {
  it("calls POST /identity/auth/logout with Authorization header", async () => {
    mockPost.mockResolvedValueOnce(undefined);

    await logout("my-token");

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/auth/logout",
      {},
      { skipAuth: true, headers: { Authorization: "Bearer my-token" } }
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
