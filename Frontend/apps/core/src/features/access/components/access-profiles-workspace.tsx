"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  LockKeyhole,
  Plus,
} from "lucide-react";
import {
  ApiError,
  type AccessProfileSummaryDto,
  type CorePermissionCatalogItemDto,
  type PermissionScope,
} from "@repo/api";
import {
  canManageCoreAccessProfiles,
  canViewCoreAccessProfiles,
  useAuth,
} from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAccessProfiles,
  useCorePermissionCatalog,
  useCreateAccessProfile,
  useDeleteAccessProfile,
  useUpdateAccessProfile,
} from "@/features/access/api/use-core-access";

const PERMISSION_GROUP_ORDER = [
  "Workspace",
  "Setup & Structure",
  "Employees",
  "Org Chart",
  "Access",
  "Access profiles",
  "Settings",
  "Module settings",
  "Self & Team",
] as const;

type GrantScopeDraft = PermissionScope | "None";

const PERMISSION_GROUP_LABELS: Record<
  (typeof PERMISSION_GROUP_ORDER)[number],
  string
> = {
  Workspace: "Overview",
  "Setup & Structure": "Setup & structure",
  Employees: "Employees",
  "Org Chart": "Org chart",
  Access: "Access",
  "Access profiles": "Access profiles",
  Settings: "Settings",
  "Module settings": "Module settings",
  "Self & Team": "Self & team",
};

const PERMISSION_SCOPE_LABELS: Record<GrantScopeDraft, string> = {
  None: "No access",
  Self: "Own profile",
  DirectReports: "Direct reports",
  OrgUnit: "Org unit",
  Tenant: "Whole organization",
  Module: "Module",
  Platform: "Platform",
};

const PERMISSION_LABEL_OVERRIDES: Record<string, string> = {
  "core.overview.view": "View overview",
  "core.structure.view": "View organization structure",
  "core.structure.manage": "Manage organization structure",
  "core.structure.publish": "Publish organization structure",
  "core.employee.manage": "Manage employee records",
  "core.employee.import": "Import employee records",
  "core.settings.view": "View settings",
  "core.settings.manage": "Manage settings",
};

const PERMISSION_HELPER_TEXT_OVERRIDES: Record<string, string> = {
  "core.employee.view": "Includes the roster and employee profile pages.",
};

const EMPTY_PERMISSION_CATALOG: CorePermissionCatalogItemDto[] = [];
const EMPTY_ACCESS_PROFILES: AccessProfileSummaryDto[] = [];
const ROLE_LIKE_PROFILE_NAME_PATTERN =
  /^\s*(ceo|cfo|coo|cio|cto|chief(?:\s+\w+){0,2}|president|vice president|vp|director|manager|partner|associate|analyst|lead|head)\s*$/i;

function buildAccessErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors.join(", ") || "The access profile update failed.";
  }

  return "The access profile update failed.";
}

function getScopeLabel(scope: GrantScopeDraft): string {
  return PERMISSION_SCOPE_LABELS[scope];
}

function getPermissionLabel(permission: {
  permissionKey: string;
  label: string;
}): string {
  return (
    PERMISSION_LABEL_OVERRIDES[permission.permissionKey] ?? permission.label
  );
}

function getPermissionHelperText(
  permission: CorePermissionCatalogItemDto
): string | null {
  return (
    PERMISSION_HELPER_TEXT_OVERRIDES[permission.permissionKey] ??
    permission.helperText ??
    null
  );
}

function getPermissionGroupLabel(group: string): string {
  return (
    PERMISSION_GROUP_LABELS[group as keyof typeof PERMISSION_GROUP_LABELS] ??
    group
  );
}

function formatPermissionGroupSummary(
  grantedCount: number,
  totalCount: number
): string {
  if (grantedCount === 0) {
    return "No access";
  }

  if (grantedCount === totalCount) {
    return "All granted";
  }

  return `${grantedCount} of ${totalCount}`;
}

function formatAssignedUserCount(count: number): string {
  return count === 1 ? "1 user" : `${count} users`;
}

function isJobTitleLikeProfileName(name: string): boolean {
  return ROLE_LIKE_PROFILE_NAME_PATTERN.test(name.trim());
}

function buildGrantDraft(
  profile: AccessProfileSummaryDto | null,
  catalog: CorePermissionCatalogItemDto[]
): Record<string, GrantScopeDraft> {
  const grantMap = Object.fromEntries(
    catalog.map((item) => [item.permissionKey, "None" as GrantScopeDraft])
  );

  if (!profile) {
    return grantMap;
  }

  for (const grant of profile.grants) {
    grantMap[grant.permissionKey] = grant.scope;
  }

  return grantMap;
}

function buildGrantInput(
  draft: Record<string, GrantScopeDraft>
): Array<{ permissionKey: string; scope: PermissionScope }> {
  return Object.entries(draft)
    .filter(([, scope]) => scope !== "None")
    .map(([permissionKey, scope]) => ({
      permissionKey,
      scope: scope as PermissionScope,
    }));
}

function AccessProfilesPageSkeleton({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 rounded-xl" />
          </CardHeader>
        </Card>
      </div>
      {children}
    </>
  );
}

export function AccessProfilesWorkspace({
  embedded: _embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { user } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();
  const canViewProfiles = canViewCoreAccessProfiles(user);
  const canManageProfiles = canManageCoreAccessProfiles(user);

  const { data: permissionCatalogData, isLoading: isCatalogLoading } =
    useCorePermissionCatalog(canViewProfiles);
  const { data: accessProfilesData, isLoading: isProfilesLoading } =
    useAccessProfiles(canViewProfiles);

  const permissionCatalog = permissionCatalogData ?? EMPTY_PERMISSION_CATALOG;
  const accessProfiles = accessProfilesData ?? EMPTY_ACCESS_PROFILES;

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [draftProfileName, setDraftProfileName] = useState("");
  const [draftProfileDescription, setDraftProfileDescription] = useState("");
  const [draftProfileGrants, setDraftProfileGrants] = useState<
    Record<string, GrantScopeDraft>
  >({});
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");

  const createProfile = useCreateAccessProfile({
    onSuccess: (data) => {
      setSelectedProfileId(data.id);
      setIsCreateDialogOpen(false);
      setNewProfileName("");
      setNewProfileDescription("");
      toast.success("Access profile created.");
    },
  });
  const updateProfile = useUpdateAccessProfile({
    onSuccess: (data) => {
      setSelectedProfileId(data.id);
      setProfileSaveError(null);
      toast.success("Access profile updated.");
    },
  });
  const deleteProfile = useDeleteAccessProfile({
    onSuccess: () => {
      setSelectedProfileId(null);
      toast.success("Access profile deleted.");
    },
  });

  useEffect(() => {
    if (!canViewProfiles || accessProfiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }

    const firstProfile = accessProfiles[0];
    if (
      firstProfile &&
      (!selectedProfileId ||
        !accessProfiles.some((profile) => profile.id === selectedProfileId))
    ) {
      setSelectedProfileId(firstProfile.id);
    }
  }, [accessProfiles, canViewProfiles, selectedProfileId]);

  const selectedProfile = useMemo(
    () =>
      accessProfiles.find((profile) => profile.id === selectedProfileId) ??
      null,
    [accessProfiles, selectedProfileId]
  );

  useEffect(() => {
    if (!selectedProfile) {
      setDraftProfileName("");
      setDraftProfileDescription("");
      setDraftProfileGrants(buildGrantDraft(null, permissionCatalog));
      return;
    }

    setDraftProfileName(selectedProfile.name);
    setDraftProfileDescription(selectedProfile.description ?? "");
    setDraftProfileGrants(buildGrantDraft(selectedProfile, permissionCatalog));
    setProfileSaveError(null);
  }, [permissionCatalog, selectedProfile]);

  const groupedPermissions = useMemo(() => {
    return PERMISSION_GROUP_ORDER.map((group) => ({
      group,
      items: permissionCatalog.filter((item) => item.group === group),
    })).filter((group) => group.items.length > 0);
  }, [permissionCatalog]);

  const grantedPermissionCount = useMemo(
    () =>
      Object.values(draftProfileGrants).filter((scope) => scope !== "None")
        .length,
    [draftProfileGrants]
  );

  const selectedProfileAssignmentsHref = selectedProfile
    ? buildTenantContextHref(
        `/access?profileId=${encodeURIComponent(selectedProfile.id)}`,
        tenantId,
        tenantSlug
      )
    : "";

  const hasProfileChanges = useMemo(() => {
    if (!selectedProfile) {
      return false;
    }

    const normalizedCurrentDescription = selectedProfile.description ?? "";
    const currentDraft = buildGrantDraft(selectedProfile, permissionCatalog);

    return (
      draftProfileName.trim() !== selectedProfile.name ||
      draftProfileDescription.trim() !== normalizedCurrentDescription ||
      JSON.stringify(draftProfileGrants) !== JSON.stringify(currentDraft)
    );
  }, [
    draftProfileDescription,
    draftProfileGrants,
    draftProfileName,
    permissionCatalog,
    selectedProfile,
  ]);

  const draftProfileNameLooksLikeJobTitle =
    isJobTitleLikeProfileName(draftProfileName);
  const newProfileNameLooksLikeJobTitle =
    isJobTitleLikeProfileName(newProfileName);

  const handleSaveProfile = async () => {
    if (!selectedProfile || !canManageProfiles) {
      return;
    }

    try {
      await updateProfile.mutateAsync({
        profileId: selectedProfile.id,
        expectedVersion: selectedProfile.version,
        input: {
          name: draftProfileName.trim(),
          description: draftProfileDescription.trim() || null,
          grants: buildGrantInput(draftProfileGrants),
        },
      });
    } catch (updateError) {
      const message = buildAccessErrorMessage(updateError);
      setProfileSaveError(message);
      toast.error(message);
    }
  };

  const handleCreateProfile = async () => {
    if (!canManageProfiles) {
      return;
    }

    try {
      await createProfile.mutateAsync({
        name: newProfileName.trim(),
        description: newProfileDescription.trim() || null,
        grants: [],
      });
    } catch (createError) {
      toast.error(buildAccessErrorMessage(createError));
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile || !canManageProfiles) {
      return;
    }

    try {
      await deleteProfile.mutateAsync({ profileId: selectedProfile.id });
    } catch (deleteError) {
      toast.error(buildAccessErrorMessage(deleteError));
    }
  };

  if (!canViewProfiles) {
    return (
      <>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={LockKeyhole}
              title="Access profiles are restricted"
              description="Ask a Core administrator for profile management access."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  if (isProfilesLoading && accessProfiles.length === 0) {
    return <AccessProfilesPageSkeleton />;
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <Card>
          <CardHeader density="compact">
            <div className="flex  justify-between gap-3 flex-col">
              <div className="flex items-center justify-between w-full">
                <CardTitle>Access profiles</CardTitle>

                {canManageProfiles ? (
                  <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-1 size-4 " />
                    New profile
                  </Button>
                ) : null}
              </div>

              <CardDescription>
                Reusable permission profiles.
                {!canManageProfiles ? " Read-only." : ""}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isProfilesLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-lg" />
              ))
            ) : accessProfiles.length === 0 ? (
                      <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        No profiles yet.
                      </div>
            ) : (
              accessProfiles.map((profile) => {
                const isSelected = profile.id === selectedProfileId;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${
                      isSelected
                        ? "border-primary/60 bg-primary/[3%] shadow-sm ring-1 ring-primary/15"
                        : "hover:border-primary/30 hover:bg-muted/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="truncate font-medium text-foreground">
                          {profile.name}
                        </p>
                        {profile.description ? (
                          <p className="line-clamp-1 text-sm text-muted-foreground">
                            {profile.description}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatAssignedUserCount(profile.assignedUserCount)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {profile.grants.length === 0
                        ? "No access"
                        : `${profile.grants.length} permissions`}
                      {profile.isSystemProtected ? " · Protected" : ""}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader density="compact" className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle>
                    {selectedProfile?.name ?? "Select an access profile"}
                  </CardTitle>
                  {selectedProfile ? (
                    <p className="text-sm text-muted-foreground">
                      {formatAssignedUserCount(
                        selectedProfile.assignedUserCount
                      )}{" "}
                      ·{" "}
                      {grantedPermissionCount === 0
                        ? "No access"
                        : grantedPermissionCount === 1
                          ? "1 permission"
                          : `${grantedPermissionCount} permissions`}
                      {selectedProfile.isSystemProtected ? " · Protected" : ""}
                    </p>
                  ) : (
                    <CardDescription>Choose a profile.</CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedProfile ? (
                      <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        Select a profile.
                      </div>
              ) : (
                <>
                  {profileSaveError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Access profile update failed</AlertTitle>
                      <AlertDescription>{profileSaveError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Profile name</Label>
                      <Input
                        id="profile-name"
                        value={draftProfileName}
                        disabled={
                          !canManageProfiles || selectedProfile.isSystemProtected
                        }
                        placeholder="e.g. Core Data Steward"
                        onChange={(event) =>
                          setDraftProfileName(event.target.value)
                        }
                      />
                      {draftProfileNameLooksLikeJobTitle ? (
                        <p className="text-xs text-amber-700">
                          Use a responsibility-based name instead of a job
                          title.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-description">Short note</Label>
                      <Input
                        id="profile-description"
                        value={draftProfileDescription}
                        disabled={
                          !canManageProfiles || selectedProfile.isSystemProtected
                        }
                        onChange={(event) =>
                          setDraftProfileDescription(event.target.value)
                        }
                        placeholder="Optional summary"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-medium">Permissions</p>

                    {isCatalogLoading ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-24 rounded-xl" />
                      ))
                    ) : (
                      <Accordion type="multiple" className="rounded-xl border">
                        {groupedPermissions.map((group) => {
                          const grantedCount = group.items.filter(
                            (item) =>
                              (draftProfileGrants[item.permissionKey] ??
                                "None") !== "None"
                          ).length;

                          return (
                            <AccordionItem
                              key={group.group}
                              value={group.group}
                              className="px-4"
                            >
                              <AccordionTrigger className="py-4 hover:no-underline">
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-4 text-left">
                                  <p className="font-medium">
                                    {getPermissionGroupLabel(group.group)}
                                  </p>
                                  <Badge variant="outline">
                                    {formatPermissionGroupSummary(
                                      grantedCount,
                                      group.items.length
                                    )}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pb-4">
                                <div className="overflow-hidden rounded-lg border">
                                  <div className="divide-y">
                                    {group.items.map((permission) => {
                                      const selectedScope =
                                        draftProfileGrants[
                                          permission.permissionKey
                                        ] ?? "None";
                                      const helperText =
                                        getPermissionHelperText(permission);

                                      return (
                                        <div
                                          key={permission.permissionKey}
                                          className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-center"
                                        >
                                          <div className="min-w-0 space-y-0.5">
                                            <p className="font-medium text-foreground">
                                              {getPermissionLabel(permission)}
                                            </p>
                                            {helperText ? (
                                              <p className="text-xs text-muted-foreground">
                                                {helperText}
                                              </p>
                                            ) : null}
                                          </div>
                                          <Select
                                            value={selectedScope}
                                            disabled={
                                              !canManageProfiles ||
                                              selectedProfile.isSystemProtected
                                            }
                                            onValueChange={(value) =>
                                              setDraftProfileGrants(
                                                (current) => ({
                                                  ...current,
                                                  [permission.permissionKey]:
                                                    value as GrantScopeDraft,
                                                })
                                              )
                                            }
                                          >
                                            <SelectTrigger
                                              className="h-9 w-full"
                                              disabled={
                                                !canManageProfiles ||
                                                selectedProfile.isSystemProtected
                                              }
                                            >
                                              <SelectValue
                                                placeholder={getScopeLabel(
                                                  "None"
                                                )}
                                              />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="None">
                                                {getScopeLabel("None")}
                                              </SelectItem>
                                              {permission.allowedScopes.map(
                                                (scope) => (
                                                  <SelectItem
                                                    key={scope}
                                                    value={scope}
                                                  >
                                                    {getScopeLabel(scope)}
                                                  </SelectItem>
                                                )
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/20 ">
                    {hasProfileChanges ? (
                      <span className="text-sm text-muted-foreground">
                        Unsaved access profile changes
                      </span>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={
                          !canManageProfiles ||
                          selectedProfile.isSystemProtected ||
                          deleteProfile.isLoading
                        }
                        onClick={() => void handleDeleteProfile()}
                      >
                        {deleteProfile.isLoading
                          ? "Deleting..."
                          : "Delete profile"}
                      </Button>
                      <Button
                        disabled={
                          !hasProfileChanges ||
                          updateProfile.isLoading ||
                          !canManageProfiles ||
                          selectedProfile.isSystemProtected
                        }
                        onClick={() => void handleSaveProfile()}
                      >
                        {updateProfile.isLoading ? "Saving..." : "Save profile"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {selectedProfile ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Assignments</CardTitle>
                <CardDescription>
                  Assignments are managed in the Access workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {formatAssignedUserCount(
                        selectedProfile.assignedUserCount
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use Access to invite people, update profile assignments,
                      and handle account activation.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={selectedProfileAssignmentsHref}>
                      Manage assignments
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create access profile</DialogTitle>
            <DialogDescription>
              Define a new reusable set of permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-profile-name">Profile name</Label>
              <Input
                id="new-profile-name"
                value={newProfileName}
                onChange={(event) => setNewProfileName(event.target.value)}
                placeholder="e.g. Core Data Steward"
              />
              {newProfileNameLooksLikeJobTitle ? (
                <p className="text-xs text-amber-700">
                  Try a responsibility-based name such as Core Data Steward or
                  HR Viewer.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-profile-description">Short note</Label>
              <Textarea
                id="new-profile-description"
                rows={2}
                value={newProfileDescription}
                onChange={(event) =>
                  setNewProfileDescription(event.target.value)
                }
                placeholder="Optional summary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                newProfileName.trim().length === 0 || createProfile.isLoading
              }
              onClick={() => void handleCreateProfile()}
            >
              {createProfile.isLoading ? "Creating..." : "Create profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
