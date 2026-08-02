import { redirect } from "next/navigation";

/**
 * Platform administration has one workspace, so its root leads straight there
 * rather than through an orientation page that would only be clicked past.
 */
export default function PlatformRootPage() {
  redirect("/tenants");
}
