import { ModuleLayout } from "@repo/ui";
import { CoreSidebar } from "@/components/core-sidebar";

export default function MainModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ModuleLayout sidebar={<CoreSidebar />}>{children}</ModuleLayout>;
}
