import { vi } from "vitest";
import dsEn from "@repo/ds/messages/en.json";
import authEn from "@repo/auth/messages/en.json";
import en from "../../messages/en.json";
import type * as TestingLibrary from "@testing-library/react";

// Every render speaks English unless a test supplies its own provider (renderWithIntl). The catalogues are imported
// here rather than from ./intl, which itself imports Testing Library.
vi.mock("@testing-library/react", async (original) => {
  const { withIntlByDefault } = await import("@repo/ds/testing/intl-by-default");
  return withIntlByDefault(await original<typeof TestingLibrary>(), { ...dsEn, ...authEn, ...en });
});
