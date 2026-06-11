"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  LockKeyhole,
  Plus,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  ApiError,
  type AccessProfileSummaryDto,
  type CorePermissionCatalogItemDto,
  type PermissionScope,
  type UserAccessAssignmentDto,
} from "@repo/api";
import {
  canAccessCoreAccess,
  canManageCoreAccessProfiles,
  useAuth,
} from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
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
import { AccessWorkspaceShell } from "@/app/(pages)/access/access-workspace-shell";
import {
  useAccessProfiles,
  useCorePermissionCatalog,
  useCreateAccessProfile,
  useDeleteAccessProfile,
  useSetUserAccessProfiles,
  useUpdateAccessProfile,
  useUserAccessAssignments,
} from "@/features/access/api/use-core-access";

const PERMISSION_GROUP_ORDER = [
  "Workspace",
  "Setup & Structure",
  "Employees",
  "Org Chart",
  "Access",
  "Settings",
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
  Settings: "Settings",
  "Self & Team": "Self & team",
};

const PERMISSION_SCOPE_LABELS: Record<GrantScopeDraft, string> = {
  None: "No access",
  Self: "Own profile",
  DirectReports: "Direct reports",
  Tenant: "Whole tenant",
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

const ACCESS_PROFILE_MANAGER_PERMISSION_KEY = "core.accessprofiles.manage";

const EMPTY_PERMISSION_CATALOG: CorePermissionCatalogItemDto[] = [];
const EMPTY_ACCESS_PROFILES: AccessProfileSummaryDto[] = [];
const EMPTY_ASSIGNMENTS: UserAccessAssignmentDto[] = [];

const ADMIN_CAPABILITY_PERMISSION_KEYS = new Set([
  ACCESS_PROFILE_MANAGER_PERMISSION_KEY,
  "core.settings.manage",
  "core.employee.manage",
  "core.structure.manage",
  "core.setup.manage",
  "core.access.manage",
]);

const ROLE_LIKE_PROFILE_NAME_PATTERN =
  /^\s*(ceo|cfo|coo|cio|cto|chief(?:\s+\w+){0,2}|president|vice president|vp|director|manager|partner|associate|analyst|lead|head)\s*$/i;

function buildAccessErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors.join(", ") || "The access profile update failed.";
  }

  return "The access profile update failed.";
}

function getScopeRank(scope: GrantScopeDraft): number {
  switch (scope) {
    case "Tenant":
      return 3;
    case "DirectReports":
      return 2;
    case "Self":
      return 1;
    default:
      return 0;
  }
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
  return PERMISSION_HELPER_TEXT_OVERRIDES[permission.permissionKey] ?? null;
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

function matchesAssignmentSearch(
  assignment: UserAccessAssignmentDto,
  searchTerm: string
): boolean {
  if (!searchTerm) {
    return true;
  }

  return [
    assignment.fullName,
    assignment.email,
    assignment.department ?? "",
    assignment.jobTitle ?? "",
  ].some((value) => value.toLowerCase().includes(searchTerm));
}

function compareAssignmentsByName(
  left: UserAccessAssignmentDto,
  right: UserAccessAssignmentDto
): number {
  return (
    left.fullName.localeCompare(right.fullName) ||
    left.email.localeCompare(right.email)
  );
}

function buildEffectiveGrantMap(
  profiles: AccessProfileSummaryDto[]
): Map<string, PermissionScope> {
  const effective = new Map<string, PermissionScope>();

  for (const profile of profiles) {
    for (const grant of profile.grants) {
      const currentScope = effective.get(grant.permissionKey);

      if (
        !currentScope ||
        getScopeRank(grant.scope) > getScopeRank(currentScope)
      ) {
        effective.set(grant.permissionKey, grant.scope);
      }
    }
  }

  return effective;
}

function getAssignmentRemovalGuardMessage(params: {
  assignments: UserAccessAssignmentDto[];
  profileId: string;
  userId: string;
  accessProfilesById: Map<string, AccessProfileSummaryDto>;
}): string | null {
  let hasAccessProfileManager = false;
  let hasAdminCapability = false;

  for (const assignment of params.assignments) {
    if (!assignment.isActive) {
      continue;
    }

    const remainingProfiles = assignment.accessProfiles
      .map((profile) => profile.id)
      .filter(
        (profileId) =>
          !(
            assignment.userId === params.userId &&
            profileId === params.profileId
          )
      )
      .map((profileId) => params.accessProfilesById.get(profileId))
      .filter((profile): profile is AccessProfileSummaryDto => !!profile);

    const effectiveGrants = buildEffectiveGrantMap(remainingProfiles);

    if (
      effectiveGrants.get(ACCESS_PROFILE_MANAGER_PERMISSION_KEY) === "Tenant"
    ) {
      hasAccessProfileManager = true;
    }

    if (
      Array.from(effectiveGrants.entries()).some(
        ([permissionKey, scope]) =>
          scope === "Tenant" &&
          ADMIN_CAPABILITY_PERMISSION_KEYS.has(permissionKey)
      )
    ) {
      hasAdminCapability = true;
    }

    if (hasAccessProfileManager && hasAdminCapability) {
      return null;
    }
  }

  if (!hasAccessProfileManager) {
    return "Keep at least one active access manager assigned.";
  }

  if (!hasAdminCapability) {
    return "Keep at least one active Core admin assigned.";
  }

  return null;
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

function formatWorkforceContext(user: UserAccessAssignmentDto): string {
  const contextParts = [user.department, user.jobTitle].filter(Boolean);

  if (contextParts.length > 0) {
    return contextParts.join(" · ");
  }

  if (user.employeeId) {
    return "Linked employee record";
  }

  return "No linked employee record";
}

function AccessProfilesPageSkeleton({
  showPeople,
  showProfiles,
}: {
  showPeople: boolean;
  showProfiles: boolean;
}) {
  return (
    <AccessWorkspaceShell active="profiles" showPeople={showPeople} showProfiles={showProfiles}>
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
    </AccessWorkspaceShell>
  );
}

export function AccessProfilesWorkspace() {
  const { user } = useAuth();
  const canViewAccess = canAccessCoreAccess(user);
  const canManageProfiles = canManageCoreAccessProfiles(user);

  const { data: permissionCatalogData, isLoading: isCatalogLoading } =
    useCorePermissionCatalog(canManageProfiles);
  const { data: accessProfilesData, isLoading: isProfilesLoading } =
    useAccessProfiles(canManageProfiles);
  const { data: assignmentsData, isLoading: isAssignmentsLoading } =
    useUserAccessAssignments(canManageProfiles);

  const permissionCatalog = permissionCatalogData ?? EMPTY_PERMISSION_CATALOG;
  const accessProfiles = accessProfilesData ?? EMPTY_ACCESS_PROFILES;
  const assignments = assignmentsData ?? EMPTY_ASSIGNMENTS;

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [draftProfileName, setDraftProfileName] = useState("");
  const [draftProfileDescription, setDraftProfileDescription] = useState("");
  const [draftProfileGrants, setDraftProfileGrants] = useState<
    Record<string, GrantScopeDraft>
  >({});
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");
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
  const setUserProfiles = useSetUserAccessProfiles({
    onSuccess: () => {
      toast.success("Access profile assignment updated.");
    },
  });

  useEffect(() => {
    if (!canManageProfiles || accessProfiles.length === 0) {
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
  }, [accessProfiles, canManageProfiles, selectedProfileId]);

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

  const accessProfilesById = useMemo(
    () => new Map(accessProfiles.map((profile) => [profile.id, profile])),
    [accessProfiles]
  );

  const selectedProfileCanManageAccessProfiles = !!selectedProfile?.grants.some(
    (grant) => grant.permissionKey === ACCESS_PROFILE_MANAGER_PERMISSION_KEY
  );

  const selectedProfileHasAdminCapability = !!selectedProfile?.grants.some(
    (grant) =>
      grant.scope === "Tenant" &&
      ADMIN_CAPABILITY_PERMISSION_KEYS.has(grant.permissionKey)
  );

  const assignedUsers = useMemo(() => {
    if (!selectedProfile) {
      return [];
    }

    return assignments
      .filter((assignment) =>
        assignment.accessProfiles.some(
          (profile) => profile.id === selectedProfile.id
        )
      )
      .slice()
      .sort(compareAssignmentsByName);
  }, [assignments, selectedProfile]);

  const filteredAssignedUsers = useMemo(() => {
    const searchTerm = assignmentSearch.trim().toLowerCase();

    return assignedUsers.filter((assignment) =>
      matchesAssignmentSearch(assignment, searchTerm)
    );
  }, [assignedUsers, assignmentSearch]);

  const grantedPermissionCount = useMemo(
    () =>
      Object.values(draftProfileGrants).filter((scope) => scope !== "None")
        .length,
    [draftProfileGrants]
  );

  const filteredAssignableUsers = useMemo(() => {
    if (!selectedProfile) {
      return [];
    }

    const searchTerm = assignmentSearch.trim().toLowerCase();

    return assignments
      .filter(
        (assignment) =>
          !assignment.accessProfiles.some(
            (profile) => profile.id === selectedProfile.id
          )
      )
      .filter((assignment) => matchesAssignmentSearch(assignment, searchTerm))
      .slice()
      .sort(compareAssignmentsByName);
  }, [assignmentSearch, assignments, selectedProfile]);

  const assignmentRemovalGuards = useMemo(() => {
    const guards = new Map<string, string>();

    if (!selectedProfile || !selectedProfileHasAdminCapability) {
      return guards;
    }

    for (const assignment of assignedUsers) {
      const guardMessage = getAssignmentRemovalGuardMessage({
        assignments,
        profileId: selectedProfile.id,
        userId: assignment.userId,
        accessProfilesById,
      });

      if (guardMessage) {
        guards.set(assignment.userId, guardMessage);
      }
    }

    return guards;
  }, [
    accessProfilesById,
    assignedUsers,
    assignments,
    selectedProfile,
    selectedProfileHasAdminCapability,
  ]);

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
    if (!selectedProfile) {
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
    if (!selectedProfile) {
      return;
    }

    try {
      await deleteProfile.mutateAsync({ profileId: selectedProfile.id });
    } catch (deleteError) {
      toast.error(buildAccessErrorMessage(deleteError));
    }
  };

  const handleToggleAssignment = async (
    assignment: UserAccessAssignmentDto
  ) => {
    if (!selectedProfile) {
      return;
    }

    const currentlyAssigned = assignment.accessProfiles.some(
      (profile) => profile.id === selectedProfile.id
    );

    const nextIds = currentlyAssigned
      ? assignment.accessProfiles
          .filter((profile) => profile.id !== selectedProfile.id)
          .map((profile) => profile.id)
      : [
          ...assignment.accessProfiles.map((profile) => profile.id),
          selectedProfile.id,
        ];

    try {
      await setUserProfiles.mutateAsync({
        userId: assignment.userId,
        input: {
          accessProfileIds: nextIds,
        },
      });
    } catch (assignmentError) {
      toast.error(buildAccessErrorMessage(assignmentError));
    }
  };

  if (!canManageProfiles) {
    return (
      <AccessWorkspaceShell active="profiles" showPeople={canViewAccess} showProfiles={false}>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={LockKeyhole}
              title="Access profiles are restricted"
              description="Ask a Core administrator for profile management access."
            />
          </CardContent>
        </Card>
      </AccessWorkspaceShell>
    );
  }

  if (isProfilesLoading && accessProfiles.length === 0) {
    return <AccessProfilesPageSkeleton showPeople={canViewAccess} showProfiles={canManageProfiles} />;
  }

  return (
    <AccessWorkspaceShell active="profiles" showPeople={canViewAccess} showProfiles={canManageProfiles}>
      <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <Card>
          <CardHeader density="compact">
            <div className="flex  justify-between gap-3 flex-col">
              <div className="flex items-center justify-between w-full">
                <CardTitle>Access profiles</CardTitle>

                <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-1 size-4 " />
                  New profile
                </Button>
              </div>

              <CardDescription>Reusable permission profiles.</CardDescription>
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
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <Badge
                          variant={
                            profile.type === "SystemSeeded"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {profile.type === "SystemSeeded"
                            ? "System"
                            : "Custom"}
                        </Badge>
                        {profile.isSystemProtected ? (
                          <Badge variant="secondary">Protected</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {formatAssignedUserCount(profile.assignedUserCount)}
                      </Badge>
                      <Badge variant="outline">
                        {profile.grants.length === 0
                          ? "No access"
                          : `${profile.grants.length} permissions`}
                      </Badge>
                    </div>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>
                      {selectedProfile?.name ?? "Select an access profile"}
                    </CardTitle>
                    {selectedProfile ? (
                      <>
                        <Badge
                          variant={
                            selectedProfile.type === "SystemSeeded"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {selectedProfile.type === "SystemSeeded"
                            ? "System"
                            : "Custom"}
                        </Badge>
                        {selectedProfile.isSystemProtected ? (
                          <Badge variant="secondary">Protected</Badge>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  {selectedProfile ? (
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">
                        {formatAssignedUserCount(
                          selectedProfile.assignedUserCount
                        )}
                      </Badge>
                      <Badge variant="outline">
                        {grantedPermissionCount === 0
                          ? "No access"
                          : grantedPermissionCount === 1
                            ? "1 permission"
                            : `${grantedPermissionCount} permissions`}
                      </Badge>
                    </div>
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

                  {selectedProfileCanManageAccessProfiles ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      <ShieldAlert className="size-4 shrink-0" />
                      <span>This profile can manage Core access.</span>
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Profile name</Label>
                      <Input
                        id="profile-name"
                        value={draftProfileName}
                        disabled={selectedProfile.isSystemProtected}
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
                        disabled={selectedProfile.isSystemProtected}
                        onChange={(event) =>
                          setDraftProfileDescription(event.target.value)
                        }
                        placeholder="Optional summary"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        People with this profile
                      </p>
                      <p className="mt-1 font-medium">
                        {formatAssignedUserCount(
                          selectedProfile.assignedUserCount
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Permission coverage
                      </p>
                      <p className="mt-1 font-medium">
                        {grantedPermissionCount === 0
                          ? "No access"
                          : `${grantedPermissionCount} granted`}
                      </p>
                    </div>
                    <div className="rounded-lg border px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Profile type
                      </p>
                      <p className="mt-1 font-medium">
                        {selectedProfile.type === "SystemSeeded"
                          ? selectedProfile.isSystemProtected
                            ? "System · Protected"
                            : "System"
                          : "Custom"}
                      </p>
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
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={assignmentSearch}
                      onChange={(event) =>
                        setAssignmentSearch(event.target.value)
                      }
                      placeholder="Search people"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Assigned users</p>
                      <Badge variant="outline">
                        {formatAssignedUserCount(
                          selectedProfile.assignedUserCount
                        )}
                      </Badge>
                    </div>

                    {isAssignmentsLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 rounded-lg" />
                      ))
                    ) : assignedUsers.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        No users assigned.
                      </div>
                    ) : filteredAssignedUsers.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        No assigned users match your search.
                      </div>
                    ) : (
                      filteredAssignedUsers.map((assignment) => {
                        const removalGuard = assignmentRemovalGuards.get(
                          assignment.userId
                        );

                        return (
                          <div
                            key={assignment.userId}
                            className="rounded-lg border bg-background px-4 py-3"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-foreground">
                                    {assignment.fullName}
                                  </p>
                                  {!assignment.isActive ? (
                                    <Badge variant="outline">Inactive</Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {assignment.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatWorkforceContext(assignment)}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {assignment.accessProfiles.map((profile) => (
                                    <Badge
                                      key={`${assignment.userId}:${profile.id}`}
                                      variant={
                                        profile.id === selectedProfile.id
                                          ? "secondary"
                                          : "outline"
                                      }
                                    >
                                      {profile.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col items-start gap-2 lg:items-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    setUserProfiles.isLoading || !!removalGuard
                                  }
                                  onClick={() =>
                                    void handleToggleAssignment(assignment)
                                  }
                                >
                                  {setUserProfiles.isLoading
                                    ? "Updating..."
                                    : "Remove"}
                                </Button>
                                {removalGuard ? (
                                  <p className="max-w-56 text-xs text-muted-foreground lg:text-right">
                                    {removalGuard}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Available to assign</p>

                    {isAssignmentsLoading ? (
                      Array.from({ length: 2 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 rounded-lg" />
                      ))
                    ) : filteredAssignableUsers.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        {assignmentSearch.trim()
                          ? "No results."
                          : "No other users available."}
                      </div>
                    ) : (
                      filteredAssignableUsers.map((assignment) => (
                        <div
                          key={assignment.userId}
                          className="rounded-lg border bg-background px-4 py-3"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">
                                  {assignment.fullName}
                                </p>
                                {!assignment.isActive ? (
                                  <Badge variant="outline">Inactive</Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {assignment.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatWorkforceContext(assignment)}
                              </p>
                              {assignment.accessProfiles.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {assignment.accessProfiles.map((profile) => (
                                    <Badge
                                      key={`${assignment.userId}:${profile.id}`}
                                      variant="outline"
                                    >
                                      {profile.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            <Button
                              size="sm"
                              disabled={setUserProfiles.isLoading}
                              onClick={() =>
                                void handleToggleAssignment(assignment)
                              }
                            >
                              {setUserProfiles.isLoading
                                ? "Assigning..."
                                : "Assign"}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
    </AccessWorkspaceShell>
  );
}
