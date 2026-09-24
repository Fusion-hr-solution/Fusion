import { OrganizationImportFrame } from "@/features/organization-import/components/import-frame";

export const dynamic = "force-dynamic";

export default async function OrganizationImportAttemptLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <OrganizationImportFrame sessionId={sessionId}>{children}</OrganizationImportFrame>;
}
