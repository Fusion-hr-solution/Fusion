"use client";

import { use } from "react";
import PeopleProfileWorkspace from "@/features/people/components/people-profile-workspace";

export default function PeopleProfilePage({ params }: { params: Promise<{ employeeKey: string }> }) {
  const { employeeKey } = use(params);
  return <PeopleProfileWorkspace employeeKey={employeeKey} />;
}
