"use client";

import Link from "next/link";
import { Button } from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
} from "@repo/ds/shell";
import {
  canManageCoreOrganization,
  canViewCoreOrganization,
  useAuth,
} from "@repo/auth";
import { ImportUploadSkeleton } from "@/features/data-import/components/import-skeletons";
import { UploadStage } from "./upload-stage";

export default function OrganizationImportWorkspace() {
  return (
    <ImportAccessGate skeleton={<ImportUploadSkeleton />}>
      <UploadStage />
    </ImportAccessGate>
  );
}

/**
 * The access boundary shared by Upload and every stage of an attempt: viewing Organization
 * is required to see anything here, and importing its structure requires management access.
 */
export function ImportAccessGate({
  skeleton,
  children,
}: {
  /** The stage-shaped skeleton shown while access resolves. */
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const canView = canViewCoreOrganization(user);
  const canManage = canManageCoreOrganization(user);

  if (isLoading) return <>{skeleton}</>;
  if (!canView)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import organization structure" />
        <PagePermissionNotice
          title="Organization access required"
          description="You do not have permission to view this tenant’s Organization."
        />
      </PageContainer>
    );
  if (!canManage)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import organization structure" />
        <PagePermissionNotice
          title="Organization management access required"
          description="You can view Organization, but importing its structure requires management access."
          action={
            <Button asChild variant="outline">
              <Link href="/organization">Back to Organization</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  return <>{children}</>;
}
