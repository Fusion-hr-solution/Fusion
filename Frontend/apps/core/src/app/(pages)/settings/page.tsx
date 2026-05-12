"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ApiError, type FieldConfigDto } from "@repo/api";
import { canAccessCoreSettings, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DraftOrgUnitKindManager } from "../setup/draft-structure/draft-org-unit-kind-manager";
import { SetupStatusBadge } from "../setup/setup-status-badge";
import { useSetupState } from "../setup/use-setup";
import {
  useTenantSettings,
  useUpdateTenantSettings,
} from "../setup/draft-structure/use-tenant-settings";
import {
  ACTIVE_EMPLOYEE_FIELD_DEFINITIONS,
  PREPARED_EMPLOYEE_FIELD_DEFINITIONS,
  buildEmployeeFieldConfigDraft,
  buildEmployeeFieldConfigInput,
  type EmployeeFieldConfigMap,
  type EmployeeFieldKey,
} from "../employees/employee-field-visibility";

const FIELD_ICONS: Record<EmployeeFieldKey, LucideIcon> = {
  firstName: UserRound,
  lastName: UserRound,
  email: Mail,
  hireDate: Calendar,
  phone: Phone,
  jobTitle: KeyRound,
};

function buildSettingsErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors.join(", ") || "The settings update failed.";
  }

  return "The settings update failed.";
}

function getFieldRuleBadges(
  field: (typeof ACTIVE_EMPLOYEE_FIELD_DEFINITIONS)[number],
  config: EmployeeFieldConfigMap[EmployeeFieldKey]
) {
  const badges: Array<{
    label: string;
    variant: "secondary" | "outline";
    title?: string;
  }> = [];

  if (field.locked) {
    badges.push({ label: "Locked", variant: "secondary" });
  }

  if (field.requiredLocked) {
    badges.push({
      label: "Required locked",
      variant: "outline",
      title:
        "Required until import and manual create flows support records without a hire date.",
    });
  } else if (config.required) {
    badges.push({ label: "Required", variant: "secondary" });
  } else {
    badges.push({ label: "Optional", variant: "outline" });
  }

  return badges;
}

function MatrixSwitch({
  checked,
  disabled,
  ariaLabel,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex justify-center">
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function SettingsPageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-136 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-md max-w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-4 w-104 max-w-full" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((__, switchIndex) => (
                      <Skeleton key={switchIndex} className="h-16 rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-[24rem] max-w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 rounded-xl" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canAccess = canAccessCoreSettings(user);
  const { data: setupState } = useSetupState(canAccess);
  const {
    data: settings,
    error,
    isLoading,
    refetch,
  } = useTenantSettings(canAccess);
  const settingsFieldConfig = useMemo(
    () => buildEmployeeFieldConfigDraft(settings),
    [settings]
  );
  const [draftFieldConfig, setDraftFieldConfig] =
    useState<EmployeeFieldConfigMap>(settingsFieldConfig);
  const [saveError, setSaveError] = useState<string | null>(null);
  const syncedVersionRef = useRef<number | null | undefined>(undefined);
  const isOrgStructureEditable = setupState?.currentPhase === "activated";

  const updateSettings = useUpdateTenantSettings({
    onSuccess: (data) => {
      syncedVersionRef.current = data.version;
      setDraftFieldConfig(buildEmployeeFieldConfigDraft(data));
      setSaveError(null);
      toast.success("Core configuration updated.");
    },
  });

  useEffect(() => {
    if (!settings) {
      return;
    }

    if (syncedVersionRef.current === settings.version) {
      return;
    }

    setDraftFieldConfig(settingsFieldConfig);
    syncedVersionRef.current = settings.version;
  }, [settings, settingsFieldConfig]);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(draftFieldConfig) !== JSON.stringify(settingsFieldConfig),
    [draftFieldConfig, settingsFieldConfig]
  );

  const handleToggle = (
    fieldKey: EmployeeFieldKey,
    property: keyof FieldConfigDto,
    nextValue: boolean
  ) => {
    const fieldDefinition = ACTIVE_EMPLOYEE_FIELD_DEFINITIONS.find(
      (field) => field.key === fieldKey
    );

    setDraftFieldConfig((current) => {
      const next = {
        ...current,
        [fieldKey]: {
          ...current[fieldKey],
          [property]: nextValue,
        },
      };

      if (
        property === "visible" &&
        !nextValue &&
        !fieldDefinition?.requiredLocked
      ) {
        next[fieldKey] = {
          ...next[fieldKey],
          required: false,
        };
      }

      if (property === "required" && nextValue) {
        next[fieldKey] = {
          ...next[fieldKey],
          visible: true,
        };
      }

      if (property === "visible" && !nextValue) {
        next[fieldKey] = {
          ...next[fieldKey],
          required: false,
        };
      }

      return next;
    });
    setSaveError(null);
  };

  const handleReset = () => {
    setDraftFieldConfig(settingsFieldConfig);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    try {
      await updateSettings.mutateAsync({
        expectedVersion: settings.version,
        input: {
          employeeFieldConfig: buildEmployeeFieldConfigInput(draftFieldConfig),
        },
      });
    } catch (updateError) {
      setSaveError(buildSettingsErrorMessage(updateError));
      toast.error(buildSettingsErrorMessage(updateError));
    }
  };

  if (!canAccess) {
    return (
      <div className="p-6">
        <EmptyState
          icon={LockKeyhole}
          title="Core configuration is HRAdmin-only"
          description="Contact a tenant HR administrator."
        />
      </div>
    );
  }

  if (isLoading || !settings) {
    return <SettingsPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Core Configuration" />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load tenant settings</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{buildSettingsErrorMessage(error)}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Core Configuration"
        actions={
          <Button variant="outline" onClick={() => router.push("/setup")}>
            Open setup
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Employee field configuration</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure which employee fields are required and visible
                    across Core.
                  </p>
                </div>
                {hasChanges ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-800"
                  >
                    Unsaved changes
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {saveError ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Settings update failed</AlertTitle>
                  <AlertDescription className="flex items-center justify-between gap-4">
                    <span>{saveError}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                    >
                      <RefreshCw className="size-4" />
                      Reload
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="overflow-hidden rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-48">Field</TableHead>
                      <TableHead className="min-w-40">Status / rule</TableHead>
                      <TableHead className="text-center">HRAdmin</TableHead>
                      <TableHead className="text-center">Required</TableHead>
                      <TableHead className="text-center">Manager</TableHead>
                      <TableHead className="text-center">
                        Collaborateur
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ACTIVE_EMPLOYEE_FIELD_DEFINITIONS.map((field) => {
                      const Icon = FIELD_ICONS[field.key];
                      const config = draftFieldConfig[field.key];
                      const ruleBadges = getFieldRuleBadges(field, config);
                      const hrAdminLocked = field.locked || config.required;

                      return (
                        <TableRow key={field.key}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="size-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">
                                {field.label}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {ruleBadges.map((badge) => (
                                <Badge
                                  key={`${field.key}-${badge.label}`}
                                  variant={badge.variant}
                                  title={badge.title}
                                >
                                  {badge.label}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <MatrixSwitch
                              checked={config.visible}
                              disabled={hrAdminLocked}
                              ariaLabel={`${field.label} visible to HRAdmin`}
                              onCheckedChange={(checked) =>
                                handleToggle(field.key, "visible", checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <MatrixSwitch
                              checked={config.required}
                              disabled={
                                field.locked ||
                                field.requiredLocked ||
                                !config.visible
                              }
                              ariaLabel={`${field.label} required`}
                              onCheckedChange={(checked) =>
                                handleToggle(field.key, "required", checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <MatrixSwitch
                              checked={config.visibleToManager}
                              ariaLabel={`${field.label} visible to Manager`}
                              onCheckedChange={(checked) =>
                                handleToggle(
                                  field.key,
                                  "visibleToManager",
                                  checked
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <MatrixSwitch
                              checked={config.visibleToEmployee}
                              ariaLabel={`${field.label} visible to Collaborateur`}
                              onCheckedChange={(checked) =>
                                handleToggle(
                                  field.key,
                                  "visibleToEmployee",
                                  checked
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {PREPARED_EMPLOYEE_FIELD_DEFINITIONS.length > 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Prepared for later:{" "}
                  {PREPARED_EMPLOYEE_FIELD_DEFINITIONS.map(
                    (field) => field.label
                  ).join(", ")}{" "}
                  is not collected or enforced in Core yet.
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {hasChanges
                    ? "Changes are ready to save."
                    : "No unsaved changes."}
                </p>
                <Button
                  variant="ghost"
                  disabled={!hasChanges}
                  onClick={handleReset}
                >
                  Reset
                </Button>
                <Button
                  disabled={!hasChanges || updateSettings.isLoading}
                  onClick={handleSave}
                >
                  {updateSettings.isLoading ? "Saving..." : "Save field rules"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Org structure configuration</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Org-unit kinds used across Setup and Core.
                  </p>
                </div>
                <DraftOrgUnitKindManager
                  schema={settings.draftStructureSchema}
                  existingUnits={[]}
                  disabled={!isOrgStructureEditable}
                  triggerLabel="Manage org-unit kinds"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {setupState ? (
                  <SetupStatusBadge status={setupState.currentPhase} />
                ) : null}
                {!isOrgStructureEditable ? (
                  <Badge variant="outline">Editing follows Setup</Badge>
                ) : (
                  <Badge variant="secondary">Editable now</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => router.push("/setup")}
                >
                  Open setup
                </Button>
              </div>

              {!isOrgStructureEditable ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Reopen the draft in Setup to edit org-unit kinds.
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.draftStructureSchema.orgUnitKinds.map((kind) => (
                      <TableRow key={kind.key}>
                        <TableCell className="font-medium">
                          {kind.displayLabel}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {kind.key}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Access policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Manager and Collaborateur rules prepare future surfaces. HRAdmin
              is the only live audience today.
            </div>
            {[
              {
                title: "PlatformAdmin",
                icon: ShieldCheck,
                body: "Tenant and platform lifecycle.",
              },
              {
                title: "HRAdmin",
                icon: Users,
                body: "Workforce configuration, imports, employees, and org chart.",
              },
              {
                title: "Manager",
                icon: UserRound,
                body: "Team visibility — configurable now, surface not yet built.",
              },
              {
                title: "Collaborateur",
                icon: LockKeyhole,
                body: "Self-profile visibility — configurable now, surface not yet built.",
              },
            ].map((role) => {
              const Icon = role.icon;
              return (
                <div key={role.title} className="rounded-2xl border p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium">{role.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {role.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
