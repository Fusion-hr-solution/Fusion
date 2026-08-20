"use client";

import { use } from "react";
import ChangeManagerWorkspace from "@/features/people/components/change-manager-workspace";

export default function ChangeManagerPage({ params }: { params: Promise<{ employeeKey: string }> }) {
  const { employeeKey } = use(params);
  return <ChangeManagerWorkspace employeeKey={employeeKey} />;
}
