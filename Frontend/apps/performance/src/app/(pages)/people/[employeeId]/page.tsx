import { PersonPage } from "@/features/performance/components/people/person-page";

/** A person inside Performance: their summary as the caller may see it. */
export default async function PersonRoute({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <PersonPage employeeId={employeeId} />;
}
