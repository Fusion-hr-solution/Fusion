import { WorkforceImportSession } from "@/features/workforce-import/components/workforce-import-session";

export const dynamic = "force-dynamic";

export default async function WorkforceImportSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <WorkforceImportSession sessionId={sessionId} />;
}
