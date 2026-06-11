import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SignInPage } from "../components/signin-page";
import { AuthProvider } from "../auth-context";
import * as authService from "../auth-service";
import { makeAuthResponse, makeApiError, makeStoredAuth } from "./helpers";

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParamGet = vi.fn<(key: string) => string | null>();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: mockSearchParamGet,
  }),
}));

// Mock auth-service
vi.mock("../auth-service", async () => {
  const actual = await vi.importActual<typeof authService>("../auth-service");
  return {
    ...actual,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    persistAuth: vi.fn(),
    loadAuth: vi.fn(),
    clearAuth: vi.fn(),
  };
});

const mockedService = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
  mockedService.loadAuth.mockReturnValue(null);
  mockSearchParamGet.mockReturnValue(null);
});

function renderSignInPage(props = {}) {
  return render(
    <AuthProvider>
      <SignInPage {...props} />
    </AuthProvider>
  );
}

describe("SignInPage", () => {
  describe("rendering", () => {
    it("renders email and password fields", () => {
      renderSignInPage();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("renders sign in button", () => {
      renderSignInPage();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("does not expose self-service signup", () => {
      renderSignInPage();

      expect(screen.queryByRole("link", { name: /sign up/i })).toBeNull();
      expect(
        screen.getByText(/ask your HR administrator for an invitation link/i)
      ).toBeInTheDocument();
    });
  });

  describe("form submission", () => {
    it("calls login with email and password", async () => {
      mockedService.login.mockResolvedValue(makeAuthResponse());
      renderSignInPage();

      await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "password123");
      await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockedService.login).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      });
    });

    it("redirects to / on successful login by default", async () => {
      mockedService.login.mockResolvedValue(makeAuthResponse());
      renderSignInPage();

      await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "password123");
      await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });

    it("redirects to callbackUrl on successful login when provided", async () => {
      mockedService.login.mockResolvedValue(makeAuthResponse());
      mockSearchParamGet.mockImplementation((key) =>
        key === "callbackUrl" ? "/core/welcome?activation=1" : null
      );
      renderSignInPage();

      await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "password123");
      await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/core/welcome?activation=1");
      });
    });

    it("uses next when callbackUrl is not present", async () => {
      mockedService.login.mockResolvedValue(makeAuthResponse());
      mockSearchParamGet.mockImplementation((key) =>
        key === "next" ? "/core/welcome?activation=1" : null
      );
      renderSignInPage();

      await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "password123");
      await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/core/welcome?activation=1");
      });
    });

    it("calls onSuccess callback on successful login", async () => {
      mockedService.login.mockResolvedValue(makeAuthResponse());
      const onSuccess = vi.fn();
      renderSignInPage({ onSuccess });

      await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "password123");
      await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it("displays errors on login failure", async () => {
      mockedService.login.mockRejectedValue(
        makeApiError(["Invalid email or password"])
      );
      renderSignInPage();

      await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "wrongpassword");
      await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });

    it("resets isSubmitting after submission", async () => {
      mockedService.login.mockResolvedValue(makeAuthResponse());
      renderSignInPage();

      await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
      await userEvent.type(screen.getByLabelText(/password/i), "password123");
      
      const submitButton = screen.getByRole("button", { name: /sign in/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe("already authenticated redirect", () => {
    it("redirects to / when already authenticated", async () => {
      mockedService.loadAuth.mockReturnValue(makeStoredAuth());
      renderSignInPage();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/");
      });
    });

    it("redirects to callbackUrl when already authenticated", async () => {
      mockedService.loadAuth.mockReturnValue(makeStoredAuth());
      mockSearchParamGet.mockImplementation((key) =>
        key === "callbackUrl" ? "/core/welcome?activation=1" : null
      );
      renderSignInPage();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/core/welcome?activation=1");
      });
    });

    it("calls onSuccess when already authenticated", async () => {
      mockedService.loadAuth.mockReturnValue(makeStoredAuth());
      const onSuccess = vi.fn();
      renderSignInPage({ onSuccess });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
      });
    });
  });
});
