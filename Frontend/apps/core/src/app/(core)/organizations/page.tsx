import { OrganizationsListView } from "@/modules/platform-admin/components/organizations-list-view";
import { PlatformOnlyGate } from "@/modules/platform-admin/components/platform-only-gate";

export default function OrganizationsListPage() {
  return (
    <PlatformOnlyGate>
      <OrganizationsListView />
    </PlatformOnlyGate>
  );
}
