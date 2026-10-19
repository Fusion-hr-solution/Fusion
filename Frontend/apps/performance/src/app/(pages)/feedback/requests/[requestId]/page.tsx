import { RequestRecord } from "@/features/performance/components/conversations/request-record";

/** R8, one feedback request: the requester reads answers, an invitee answers or declines. */
export default async function FeedbackRequestRoute({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <RequestRecord requestId={requestId} />;
}
