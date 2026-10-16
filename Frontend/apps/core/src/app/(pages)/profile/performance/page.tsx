"use client";

export const dynamic = "force-dynamic";

import { MyProfile } from "../my-profile";

/** The signed-in person's own record, Performance view. */
export default function MyPerformancePage() {
  return <MyProfile view="performance" />;
}
