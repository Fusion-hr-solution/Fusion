import { redirect } from "next/navigation";

export default async function EmployeesCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const source = await searchParams;
  const target = new URLSearchParams();
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) value.forEach((item) => target.append(key, item));
    else if (value !== undefined) target.set(key, value);
  }
  redirect(`/people${target.size ? `?${target.toString()}` : ""}`);
}
