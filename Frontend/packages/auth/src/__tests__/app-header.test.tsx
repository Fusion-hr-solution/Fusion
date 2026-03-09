import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { AppHeader } from "../components/app-header";
import { AuthProvider } from "../auth-context";
import * as authService from "../auth-service";
import { makeStoredAuth } from "./helpers";

function renderWithProvider(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

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

describe("AppHeader – navigation", () => {
  it("renders all nav links", async () => {
    renderWithProvider(<AppHeader />);

    await waitFor(() =>
      expect(screen.getByText("Home")).toBeInTheDocument(),
    );
    expect(screen.getByText("Interview")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("Recruitment")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });

  it("highlights the active nav item", async () => {
    renderWithProvider(<AppHeader activeApp="Core" />);

    await waitFor(() =>
      expect(screen.getByText("Core")).toBeInTheDocument(),
    );

    const coreLink = screen.getByText("Core");
    expect(coreLink.className).toContain("text-foreground");
    expect(coreLink.className).not.toContain("text-foreground/60");

    const homeLink = screen.getByText("Home");
    expect(homeLink.className).toContain("text-foreground/60");
  });

  it("renders the Frontend logo/title", async () => {
    renderWithProvider(<AppHeader />);

    await waitFor(() =>
      expect(screen.getByText("Frontend")).toBeInTheDocument(),
    );
  });
});

describe("AppHeader – auth integration", () => {
  it("shows Sign In / Sign Up when not authenticated", async () => {
    renderWithProvider(<AppHeader />);

    await waitFor(() =>
      expect(screen.getByText("Sign In")).toBeInTheDocument(),
    );
    expect(screen.getByText("Sign Up")).toBeInTheDocument();
  });

  it("shows user name and Sign Out when authenticated", async () => {
    mockedService.loadAuth.mockReturnValue(makeStoredAuth());

    renderWithProvider(<AppHeader activeApp="Home" />);

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument(),
    );
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });
});

describe("AppHeader – nav link hrefs", () => {
  it("links to correct routes", async () => {
    renderWithProvider(<AppHeader />);

    await waitFor(() =>
      expect(screen.getByText("Home")).toBeInTheDocument(),
    );

    const links: Record<string, string> = {
      Home: "/",
      Interview: "/interview",
      Core: "/core",
      Learning: "/learning",
      Performance: "/performance",
      Recruitment: "/recruitment",
      Onboarding: "/onboarding",
    };

    for (const [label, href] of Object.entries(links)) {
      const link = screen.getByText(label).closest("a");
      expect(link).toHaveAttribute("href", href);
    }
  });
});
