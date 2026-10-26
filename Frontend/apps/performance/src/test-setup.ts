import { vi } from "vitest";
import dsEn from "@repo/ds/messages/en.json";
import authEn from "@repo/auth/messages/en.json";
import { englishMessages as en } from "./i18n/messages";
import type * as TestingLibrary from "@testing-library/react";

// Every render speaks English unless a test supplies its own provider.
vi.mock("@testing-library/react", async (original) => {
  const { withIntlByDefault } = await import("@repo/ds/testing/intl-by-default");
  return withIntlByDefault(await original<typeof TestingLibrary>(), { ...dsEn, ...authEn, ...en });
});
