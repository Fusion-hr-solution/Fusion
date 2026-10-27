import { redirect } from "next/navigation";

/** Changes happen in the change panel now; old links open the profile with it. */
export default async function OldChangePage({ params }: { params: Promise<{ employeeKey: string }> }) {
  const { employeeKey } = await params;
  redirect(`/people/${encodeURIComponent(employeeKey)}?change=job`);
}
