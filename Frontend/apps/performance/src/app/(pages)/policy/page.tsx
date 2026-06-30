import type { Metadata } from "next";
import { ObjectivePolicyPage } from "@/components/objective-policy/objective-policy-page";

export const metadata: Metadata = {
  title: "Objective Policy | EY Performance",
};

export default function PolicyPage() {
  return <ObjectivePolicyPage />;
}
