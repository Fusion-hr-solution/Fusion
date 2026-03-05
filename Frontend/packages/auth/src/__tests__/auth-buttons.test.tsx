import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { AuthButtons } from "../components/auth-buttons";
import { AuthProvider } from "../auth-context";
import * as authService from "../auth-service";
import { makeStoredAuth } from "./helpers";

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
});

function renderButtons() {
  return render(
    <AuthProvider>
      <AuthButtons />
    </AuthProvider>,
  );
}

describe("AuthButtons – unauthenticated", () => {
  it("shows Sign In and Sign Up buttons when logged out", async () => {
    renderButtons();

    await waitFor(() =>
      expect(screen.getByText("Sign In")).toBeInTheDocument(),
    );
    expect(screen.getByText("Sign Up")).toBeInTheDocument();
  });

  it("Sign In links to /auth/signin", async () => {
    renderButtons();

    await waitFor(() =>
      expect(screen.getByText("Sign In")).toBeInTheDocument(),
    );
    const link = screen.getByText("Sign In").closest("a");
    expect(link).toHaveAttribute("href", "/auth/signin");
  });

  it("Sign Up links to /auth/signup", async () => {
    renderButtons();

    await waitFor(() =>
      expect(screen.getByText("Sign Up")).toBeInTheDocument(),
    );
    const link = screen.getByText("Sign Up").closest("a");
    expect(link).toHaveAttribute("href", "/auth/signup");
  });
});

describe("AuthButtons – authenticated", () => {
  beforeEach(() => {
    mockedService.loadAuth.mockReturnValue(makeStoredAuth());
  });

  it("shows user name and Sign Out button", async () => {
    renderButtons();

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument(),
    );
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
  });

  it("calls logout on Sign Out click", async () => {
    const user = userEvent.setup();
    mockedService.logout.mockResolvedValue(undefined);

    renderButtons();

    await waitFor(() =>
      expect(screen.getByText("Sign Out")).toBeInTheDocument(),
    );

    await user.click(screen.getByText("Sign Out"));

    await waitFor(() =>
      expect(mockedService.clearAuth).toHaveBeenCalled(),
    );
  });
});
