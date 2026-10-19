import { redirect } from "next/navigation";
import { roundHref } from "@/lib/performance-routes";

/** The round setup wizard became one page (board 04): old setup links land on the round. */
export default async function RoundSetupRedirect({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  redirect(roundHref(roundId));
}
