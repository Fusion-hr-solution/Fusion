import type { Metadata } from "next";
import { PlatformDefaultsPage } from "@/components/platform-defaults/platform-defaults-page";

export const metadata: Metadata = {
  title: "Platform Performance Configuration | EY Performance",
};

export default function PlatformPerformanceConfigurationPage() {
  return <PlatformDefaultsPage />;
}
