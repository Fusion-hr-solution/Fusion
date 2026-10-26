import { describe, expect, it } from "vitest";
import { daysFromToday, formatDate, formatDateRange, formatDateTime, formatRelative, formatTime, recencyOf } from "./dates";

const now = new Date(2026, 9, 23, 15, 0);

describe("dates", () => {
  it("says the year only outside this year", () => {
    expect(formatDate("2026-10-20", { now })).toBe("20 Oct");
    expect(formatDate("2025-10-20", { now })).toBe("20 Oct 2025");
    expect(formatDate("2026-10-20", { now, year: "always" })).toBe("20 Oct 2026");
  });

  it("adds the weekday when asked, without a comma", () => {
    expect(formatDate("2026-10-20", { now, weekday: true })).toBe("Tue 20 Oct");
  });

  it("reads a date-only value as that calendar day", () => {
    expect(formatDate("2026-01-01", { now, year: "always" })).toBe("1 Jan 2026");
  });

  it("formats times in 24 hours and instants with their weekday", () => {
    const at = new Date(2026, 9, 22, 11, 0);
    expect(formatTime(at)).toBe("11:00");
    expect(formatDateTime(at, { now })).toBe("Thu 22 Oct, 11:00");
  });

  it("says a range's shared year once", () => {
    expect(formatDateRange("2026-10-10", "2026-11-09")).toBe("10 Oct – 9 Nov 2026");
    expect(formatDateRange("2026-10-10", "2027-10-09")).toBe("10 Oct 2026 – 9 Oct 2027");
    expect(formatDateRange("2026-10-10", "2026-11-09", { omitYear: true })).toBe("10 Oct – 9 Nov");
  });

  it("gives recency, then the date", () => {
    expect(formatRelative(new Date(2026, 9, 23, 14, 50), now)).toBe("10 min ago");
    expect(formatRelative("2026-10-22", now)).toBe("Yesterday");
    expect(formatRelative("2026-10-13", now)).toBe("10 days ago");
    expect(formatRelative("2026-08-01", now)).toBe("1 Aug");
  });

  it("formats in French when given the person's language, and in English for anything else", () => {
    const at = new Date(2026, 9, 20, 11, 0);
    expect(formatDate("2026-10-20", { now, weekday: true, locale: "fr" })).toBe("mar. 20 oct.");
    expect(formatDate("2025-09-30", { now, locale: "fr" })).toBe("30 sept. 2025");
    expect(formatDateTime(at, { now, locale: "fr" })).toBe("mar. 20 oct. à 11:00");
    expect(formatDateRange("2026-10-10", "2026-11-09", { locale: "fr" })).toBe("10 oct. – 9 nov. 2026");
    expect(formatDate("2026-10-20", { now, weekday: true, locale: "de" })).toBe("Tue 20 Oct");
  });

  it("names a moment's recency for translated screens to put into words", () => {
    expect(recencyOf(new Date(2026, 9, 23, 14, 48), now)).toEqual({ unit: "minutes", count: 12 });
    expect(recencyOf("2026-10-22", now)).toEqual({ unit: "yesterday" });
    expect(recencyOf("2026-08-01", now)).toEqual({ unit: "date", date: new Date(2026, 7, 1) });
    expect(recencyOf(null, now)).toBeNull();
  });

  it("counts calendar days and falls back on empty input", () => {
    expect(daysFromToday("2026-10-21", now)).toBe(-2);
    expect(formatDate(null)).toBe("–");
    expect(formatDate(undefined, { fallback: "" })).toBe("");
  });
});
