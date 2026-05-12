import { SessionDetailView } from "@/components/admin/sessions";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function AdminSessionDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
  return (
    <div className="p-6">
      <SessionDetailView sessionId={sessionId} />
    </div>
  );
}
