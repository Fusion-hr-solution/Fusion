import type { Metadata } from "next";
import { ConfigurationHubPage } from "@/components/performance-configuration/configuration-hub-page";

export const metadata: Metadata = { title: "Configuration | EY Performance" };

export default function ConfigurationRoute() {
  return <ConfigurationHubPage />;
}
