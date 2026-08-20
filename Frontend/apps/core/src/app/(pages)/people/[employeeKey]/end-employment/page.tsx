"use client";

import { use } from "react";
import EndEmploymentWorkspace from "@/features/people/components/end-employment-workspace";

export default function EndEmploymentPage({ params }: { params: Promise<{ employeeKey: string }> }) {
  const { employeeKey } = use(params);
  return <EndEmploymentWorkspace employeeKey={employeeKey} />;
}
