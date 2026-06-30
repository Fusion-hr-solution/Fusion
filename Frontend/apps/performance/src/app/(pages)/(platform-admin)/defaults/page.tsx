import type { Metadata } from "next";
import { PlatformDefaultsPage } from "@/components/platform-defaults/platform-defaults-page";

export const metadata: Metadata = {
  title: "Platform Defaults | EY Performance",
};

export default function DefaultsPage() {
  return <PlatformDefaultsPage />;
}
