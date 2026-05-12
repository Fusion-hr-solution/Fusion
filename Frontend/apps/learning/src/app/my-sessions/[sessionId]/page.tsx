import { SessionDetailView } from "@/components/my-sessions/session-detail-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  const { sessionId } = await params;
  return <SessionDetailView sessionId={sessionId} />;
}
