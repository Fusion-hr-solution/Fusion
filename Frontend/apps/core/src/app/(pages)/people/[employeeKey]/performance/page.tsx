import { redirect } from "next/navigation";

/** Performance is a tab of the record now; old links open it there. */
export default async function OldPerformancePage({ params }: { params: Promise<{ employeeKey: string }> }) {
  const { employeeKey } = await params;
  redirect(`/people/${encodeURIComponent(employeeKey)}?tab=performance`);
}
