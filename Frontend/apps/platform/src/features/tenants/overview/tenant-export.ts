import type { TenantOverviewRow } from "../api";
import {
  DELIVERY_LABEL,
  INVITATION_LABEL,
  TENANT_STATUS_LABEL,
  moduleLabel,
} from "../language";

/**
 * The tenant directory as a file.
 *
 * It carries the same facts the list shows and nothing more: no credential
 * material, no invitation identifiers, no internal failure codes. An export
 * leaves the product, so it says only what a Platform Administrator already
 * reads on screen.
 */

const COLUMNS = [
  "Tenant",
  "Tenant status",
  "Initial administrator",
  "Invitation status",
  "Delivery outcome",
  "Enabled modules",
  "Created",
] as const;

/**
 * A leading =, +, - or @ makes a spreadsheet treat the value as a formula. A
 * tenant is named by a customer, so the cell is neutralised rather than trusted.
 */
function escapeCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(rows: TenantOverviewRow[]): string {
  const lines = [COLUMNS.map(escapeCell).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.name,
        TENANT_STATUS_LABEL[row.administratorActivationStatus],
        row.initialAdministratorEmail ?? "",
        row.invitationState ? INVITATION_LABEL[row.invitationState] : "",
        row.lastDeliveryOutcome ? DELIVERY_LABEL[row.lastDeliveryOutcome] : "",
        row.modules.map(moduleLabel).join("; "),
        // ISO keeps the file sortable and unambiguous between locales, which a
        // rendered date would not be.
        row.createdAt.slice(0, 10),
      ]
        .map(escapeCell)
        .join(",")
    );
  }

  // A trailing newline, so appending or concatenating the file behaves.
  return `${lines.join("\r\n")}\r\n`;
}

export function exportFileName(now: Date = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return `fusion-tenants-${stamp}.csv`;
}

/** A BOM so Excel reads the file as UTF-8 rather than mangling accented names. */
export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
}
