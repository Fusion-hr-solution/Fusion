"use client";

import { use } from "react";
import ChangeWorkWorkspace from "@/features/people/components/change-work-workspace";

export default function ChangeWorkPage({ params }: { params: Promise<{ employeeKey: string }> }) {
  const { employeeKey } = use(params);
  return <ChangeWorkWorkspace employeeKey={employeeKey} />;
}
