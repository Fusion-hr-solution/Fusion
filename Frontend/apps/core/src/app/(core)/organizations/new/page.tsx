import { CreateOrganizationForm } from "@/modules/platform-admin/components/create-organization-form";
import { PlatformOnlyGate } from "@/modules/platform-admin/components/platform-only-gate";

export default function CreateOrganizationPage() {
  return (
    <PlatformOnlyGate>
      <CreateOrganizationForm />
    </PlatformOnlyGate>
  );
}
