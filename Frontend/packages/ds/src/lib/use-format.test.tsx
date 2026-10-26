import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { IntlTestProvider } from "../testing/intl";
import fr from "../messages/fr.json";
import { englishSay, useSay } from "./say";
import { useFormat } from "./use-format";

const now = new Date(2026, 9, 25, 12, 0);
const inFrench = ({ children }: { children: ReactNode }) => (
  <IntlTestProvider locale="fr" messages={fr}>
    {children}
  </IntlTestProvider>
);

describe("useFormat", () => {
  it("formats in English by default", () => {
    const { result } = renderHook(() => useFormat());
    expect(result.current.date("2026-10-20", { weekday: true, now })).toBe("Tue 20 Oct");
    expect(result.current.count(1234)).toBe("1,234");
    expect(result.current.relative(new Date(2026, 9, 25, 11, 48), now)).toBe("12 min ago");
  });

  it("formats in the person's language", () => {
    const { result } = renderHook(() => useFormat(), { wrapper: inFrench });
    expect(result.current.date("2026-10-20", { weekday: true, now })).toBe("mar. 20 oct.");
    expect(result.current.count(1234)).toBe("1 234");
    expect(result.current.percent(0.42)).toBe("42 %");
    expect(result.current.relative(new Date(2026, 9, 25, 11, 48), now)).toBe("Il y a 12 min");
  });
});

describe("Say", () => {
  it("says a namespace's lines in English outside a translated tree", () => {
    const say = englishSay({ greet: { hello: "Hello {name}" } }, "greet");
    expect(say("hello", { name: "Amira" })).toBe("Hello Amira");
  });

  it("says a namespace's lines in the person's language", () => {
    const { result } = renderHook(() => useSay("ds.relative"), { wrapper: inFrench });
    expect(result.current("yesterday")).toBe("Hier");
  });
});
