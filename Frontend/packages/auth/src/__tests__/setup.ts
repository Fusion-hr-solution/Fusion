import "@testing-library/jest-dom/vitest";
import dsEn from "@repo/ds/messages/en.json";
import en from "../messages/en.json";
import type * as TestingLibrary from "@testing-library/react";

// Every render speaks English unless a test supplies its own provider.
vi.mock("@testing-library/react", async (original) => {
  const { withIntlByDefault } = await import("@repo/ds/testing/intl-by-default");
  return withIntlByDefault(await original<typeof TestingLibrary>(), { ...dsEn, ...en });
});

// ── Mock localStorage ────────────────────────────────────────────────
const store: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// ── Reset state between tests ────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
  document.cookie = "";
  vi.restoreAllMocks();
});
