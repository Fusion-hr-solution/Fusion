export type CsvCandidateRow = {
  name: string;
  email: string;
};

export type CsvExtractResult = {
  rows: CsvCandidateRow[];
  emails: string[];
  invalidCount: number;
  duplicateCount: number;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_HEADER_KEYS = new Set([
  "email",
  "emailaddress",
  "emailid",
  "e-mail",
  "e-mailaddress",
  "mail",
]);
const NAME_HEADER_KEYS = new Set([
  "name",
  "fullname",
  "full_name",
  "candidate",
  "candidatename",
  "candidate_name",
  "applicant",
]);
const CSV_DELIMITERS = [",", ";", "\t"] as const;

function decodeWithEncoding(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export async function readCsvFileText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) {
    return "";
  }

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decodeWithEncoding(bytes.subarray(3), "utf-8");
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeWithEncoding(bytes.subarray(2), "utf-16le");
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeWithEncoding(bytes.subarray(2), "utf-16be");
  }

  const utf8Text = decodeWithEncoding(bytes, "utf-8");
  if (utf8Text.includes("\u0000")) {
    return decodeWithEncoding(bytes, "utf-16le");
  }

  return utf8Text;
}

function countUnquotedDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectCsvDelimiter(headerLine: string): string {
  let selected = ",";
  let maxCount = -1;

  for (const delimiter of CSV_DELIMITERS) {
    const currentCount = countUnquotedDelimiter(headerLine, delimiter);
    if (currentCount > maxCount) {
      maxCount = currentCount;
      selected = delimiter;
    }
  }

  return selected;
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeHeaderCell(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizeEmailValue(value: string): string {
  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();

  const bracketMatch = cleaned.match(/<([^<>]+)>/);
  const extracted = bracketMatch?.[1] ?? cleaned;
  return extracted.trim().toLowerCase();
}

function normalizeNameValue(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let currentRecord = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        currentRecord += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      currentRecord += character;
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      const trimmedRecord = currentRecord.trim();
      if (trimmedRecord.length > 0) {
        records.push(trimmedRecord);
      }
      currentRecord = "";
      if (character === "\r" && content[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    currentRecord += character;
  }

  const trimmedRecord = currentRecord.trim();
  if (trimmedRecord.length > 0) {
    records.push(trimmedRecord);
  }

  return records;
}

export function extractEmailsFromCsv(content: string): CsvExtractResult {
  const normalizedContent = content.replace(/\u0000/g, "").replace(/^\uFEFF/, "");
  const lines = splitCsvRecords(normalizedContent);

  if (lines.length === 0) {
    return {
      rows: [],
      emails: [],
      invalidCount: 0,
      duplicateCount: 0,
    };
  }

  const delimiter = detectCsvDelimiter(lines[0] ?? "");
  const rows = lines.map((line) => parseCsvRow(line, delimiter));
  const header = rows[0]?.map(normalizeHeaderCell) ?? [];
  const emailColumnIndex = header.findIndex((cell) => EMAIL_HEADER_KEYS.has(cell));
  const nameColumnIndex = header.findIndex((cell) => NAME_HEADER_KEYS.has(cell));
  const dataStartIndex = emailColumnIndex >= 0 ? 1 : 0;
  const uniqueCandidates = new Map<string, CsvCandidateRow>();
  let invalidCount = 0;
  let duplicateCount = 0;

  function deriveNameFromRow(row: string[], emailIndex: number): string {
    if (nameColumnIndex >= 0) {
      return normalizeNameValue(row[nameColumnIndex] ?? "");
    }

    for (let i = 0; i < row.length; i += 1) {
      if (i === emailIndex) {
        continue;
      }
      const nameCandidate = normalizeNameValue(row[i] ?? "");
      if (!nameCandidate) {
        continue;
      }
      const maybeEmail = normalizeEmailValue(nameCandidate);
      if (!EMAIL_REGEX.test(maybeEmail)) {
        return nameCandidate;
      }
    }

    return "";
  }

  function collectCandidate(rawEmail: string, rawName: string, strictEmailColumn: boolean): void {
    const candidateEmail = normalizeEmailValue(rawEmail);
    const candidateName = normalizeNameValue(rawName);

    if (!candidateEmail) {
      return;
    }

    if (!EMAIL_REGEX.test(candidateEmail)) {
      if (strictEmailColumn || candidateEmail.includes("@")) {
        invalidCount += 1;
      }
      return;
    }

    const existing = uniqueCandidates.get(candidateEmail);
    if (existing) {
      duplicateCount += 1;
      if (!existing.name && candidateName) {
        uniqueCandidates.set(candidateEmail, {
          email: candidateEmail,
          name: candidateName,
        });
      }
      return;
    }

    uniqueCandidates.set(candidateEmail, {
      email: candidateEmail,
      name: candidateName,
    });
  }

  for (let rowIndex = dataStartIndex; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    if (emailColumnIndex >= 0) {
      const rowName = deriveNameFromRow(row, emailColumnIndex);
      collectCandidate(row[emailColumnIndex] ?? "", rowName, true);
      continue;
    }

    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const rowName = deriveNameFromRow(row, cellIndex);
      collectCandidate(row[cellIndex] ?? "", rowName, false);
    }
  }

  const uniqueRows = Array.from(uniqueCandidates.values());

  return {
    rows: uniqueRows,
    emails: uniqueRows.map((item) => item.email),
    invalidCount,
    duplicateCount,
  };
}
