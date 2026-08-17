import { redirect } from "next/navigation";

export default async function EmployeeProfileCompatibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, source] = await Promise.all([params, searchParams]);
  const target = new URLSearchParams();
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) value.forEach((item) => target.append(key, item));
    else if (value !== undefined) target.set(key, value);
  }
  redirect(`/people/${encodeURIComponent(id)}${target.size ? `?${target.toString()}` : ""}`);
}
