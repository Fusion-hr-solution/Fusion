"use client";

import { use } from "react";
import PeopleProfileWorkspace from "@/features/people/components/people-profile-workspace";

/** A person's Core HR record, Performance view (D-32). */
export default function PeoplePerformancePage({ params }: { params: Promise<{ employeeKey: string }> }) {
  const { employeeKey } = use(params);
  return <PeopleProfileWorkspace employeeKey={employeeKey} view="performance" />;
}
