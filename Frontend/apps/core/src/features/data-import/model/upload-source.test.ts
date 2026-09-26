import { describe, expect, it } from "vitest";
import {
  checkLocalSource,
  classifyIntakeProblem,
  formatFileSize,
  formatModified,
  isValidEffectiveDate,
} from "./upload-source";

const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

describe("checkLocalSource", () => {
  it("accepts XLSX and CSV of any meaning", () => {
    expect(checkLocalSource(file("Lumera.XLSX", 10))).toBeNull();
    expect(checkLocalSource(file("org.csv", 10))).toBeNull();
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(checkLocalSource(file("org.pdf", 10))?.category).toBe("UnsupportedFileType");
    expect(checkLocalSource(file("org.csv", 0))?.category).toBe("EmptySource");
    expect(checkLocalSource(file("org.csv", 10 * 1024 * 1024 + 1))?.category).toBe("SourceTooLarge");
  });
});

describe("classifyIntakeProblem", () => {
  it("branches on stable codes, keeping specific server wording for source defects", () => {
    const problem = classifyIntakeProblem({ kind: "rejected", code: "PasswordProtected", message: "Password-protected workbooks are not supported." });
    expect(problem).toEqual({
      category: "UnreadableSource",
      message: "Password-protected workbooks are not supported.",
      retryable: false,
    });
    expect(classifyIntakeProblem({ kind: "rejected", code: "RowLimitExceeded", message: "x" }).category).toBe("SourceTooLarge");
    expect(classifyIntakeProblem({ kind: "rejected", code: "Empty", message: "x" }).category).toBe("EmptySource");
  });

  it("treats a token conflict as a source conflict, not a retry", () => {
    const problem = classifyIntakeProblem({ kind: "conflict", code: "IdempotencyConflict", message: "This upload token…" });
    expect(problem.category).toBe("SourceConflict");
    expect(problem.retryable).toBe(false);
    expect(problem.message).not.toMatch(/token/);
  });

  it("makes only infrastructure failure retryable", () => {
    expect(classifyIntakeProblem({ kind: "temporary", code: null, message: "Network Error" })).toMatchObject({
      category: "IntakeFailed",
      retryable: true,
    });
    expect(classifyIntakeProblem({ kind: "access-denied", code: null, message: "" }).category).toBe("PermissionDenied");
  });
});

describe("isValidEffectiveDate", () => {
  it("accepts real calendar dates only, past or future", () => {
    expect(isValidEffectiveDate("2019-01-01")).toBe(true);
    expect(isValidEffectiveDate("2027-09-01")).toBe(true);
    expect(isValidEffectiveDate("2027-02-30")).toBe(false);
    expect(isValidEffectiveDate("")).toBe(false);
  });
});

describe("file metadata", () => {
  it("formats size and modification time the way people read them", () => {
    expect(formatFileSize(742 * 1024)).toBe("742 KB");
    expect(formatFileSize(3.25 * 1024 * 1024)).toBe("3.3 MB");
    const now = new Date(2027, 8, 1, 15, 0);
    expect(formatModified(new Date(2027, 8, 1, 10, 24).getTime(), now)).toBe("Modified today at 10:24 AM");
    expect(formatModified(new Date(2027, 7, 31, 9, 5).getTime(), now)).toBe("Modified yesterday at 9:05 AM");
    expect(formatModified(new Date(2027, 0, 3).getTime(), now)).toBe("Modified 3 Jan 2027");
  });
});
