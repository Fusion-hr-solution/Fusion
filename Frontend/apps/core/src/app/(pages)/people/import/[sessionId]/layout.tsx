import { WorkforceImportFrame } from "@/features/workforce-import/components/workforce-import-frame";

export const dynamic = "force-dynamic";

export default async function WorkforceImportAttemptLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <WorkforceImportFrame sessionId={sessionId}>{children}</WorkforceImportFrame>;
}
