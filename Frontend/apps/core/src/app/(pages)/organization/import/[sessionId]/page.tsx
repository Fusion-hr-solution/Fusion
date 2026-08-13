import OrganizationImportWorkspace from "@/features/organization-import/components/organization-import-workspace";

export const dynamic = "force-dynamic";

export default async function OrganizationImportSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <OrganizationImportWorkspace sessionId={sessionId} />;
}
