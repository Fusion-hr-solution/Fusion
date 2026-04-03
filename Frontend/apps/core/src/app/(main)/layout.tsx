import { ModuleLayout } from "@repo/ui";
import { PlatformAdminSidebar } from "@/modules/platform-admin/components/platform-admin-sidebar";

export default function MainModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ModuleLayout sidebar={<PlatformAdminSidebar />}>{children}</ModuleLayout>;
}
