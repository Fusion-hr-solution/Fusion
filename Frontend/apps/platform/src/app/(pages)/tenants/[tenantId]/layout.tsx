import { TenantRecordShell } from "@/features/tenants/record/record-shell";

/**
 * The shared tenant record frame.
 *
 * The tenant is loaded once here and read from context by every destination, so
 * moving between Overview, Access, Products, and Activity is navigation within
 * one record rather than four pages that each refetch the tenant.
 */
export default async function TenantRecordLayout({
  params,
  children,
}: {
  params: Promise<{ tenantId: string }>;
  children: React.ReactNode;
}) {
  const { tenantId } = await params;

  return <TenantRecordShell tenantId={tenantId}>{children}</TenantRecordShell>;
}
