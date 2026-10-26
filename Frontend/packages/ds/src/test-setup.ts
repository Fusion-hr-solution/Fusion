import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import en from "./messages/en.json";
import type * as TestingLibrary from "@testing-library/react";

// Every render speaks English unless a test supplies its own provider (renderWithIntl).
vi.mock("@testing-library/react", async (original) => {
  const { withIntlByDefault } = await import("./testing/intl-by-default");
  return withIntlByDefault(await original<typeof TestingLibrary>(), en);
});
