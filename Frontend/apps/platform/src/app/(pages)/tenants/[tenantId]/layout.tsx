import type { ReactNode } from "react";
import { TenantRecordShell } from "@/features/tenants/record/record-shell";

/**
 * The tenant record's shared frame. Holding it in a layout means the header,
 * the destinations and the loaded tenant survive navigation between them —
 * moving from Overview to Audit is a change of view, not a new page that
 * re-reads the tenant.
 */
export default async function TenantRecordLayout({
  params,
  children,
}: {
  params: Promise<{ tenantId: string }>;
  children: ReactNode;
}) {
  const { tenantId } = await params;
  return <TenantRecordShell tenantId={tenantId}>{children}</TenantRecordShell>;
}
