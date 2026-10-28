import { redirect } from "next/navigation";

/** Performance is a tab of My profile now; old links open it there. */
export default function OldMyPerformancePage() {
  redirect("/profile?tab=performance");
}
