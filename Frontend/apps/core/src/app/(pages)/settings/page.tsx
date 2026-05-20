"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { ApiError, type FieldConfigDto } from "@repo/api";
import { canAccessCoreSettings, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
import { useCoreSetupAccess } from "@/components/core-setup-access";
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
import {
  useTenantSettings,
  useUpdateTenantSettings,
} from "../setup/draft-structure/use-tenant-settings";
import {
  ACTIVE_EMPLOYEE_FIELD_DEFINITIONS,
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
  workLocation: MapPin,
  employmentType: KeyRound,
  jobTitle: KeyRound,
};

const DEFAULT_SELF_SERVICE_SETTINGS = {
  canEditPreferredName: true,
  canEditPhone: true,
} as const;

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
      label: "Required",
      variant: "secondary",
      title: "This field is required for the current Core workforce record.",
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
        <Skeleton className="h-4 w-[34rem] max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-[20rem] max-w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-4 w-[26rem] max-w-full" />
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
  const { tenantId } = useTenantContext();
  const setupHref = buildTenantContextHref("/setup", tenantId);
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessCoreSettings(user) || isTenantContextReadOnly;
  const { setupState } = useCoreSetupAccess();
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
  const settingsSelfService = useMemo(
    () => settings?.selfService ?? DEFAULT_SELF_SERVICE_SETTINGS,
    [settings]
  );
  const [draftFieldConfig, setDraftFieldConfig] =
    useState<EmployeeFieldConfigMap>(settingsFieldConfig);
  const [draftSelfService, setDraftSelfService] = useState(settingsSelfService);
  const [saveError, setSaveError] = useState<string | null>(null);
  const syncedVersionRef = useRef<number | null | undefined>(undefined);
  const isOrgStructureEditable = setupState?.currentPhase === "activated";

  const updateSettings = useUpdateTenantSettings({
    onSuccess: (data) => {
      syncedVersionRef.current = data.version;
      setDraftFieldConfig(buildEmployeeFieldConfigDraft(data));
      setDraftSelfService(data.selfService);
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
    setDraftSelfService(settingsSelfService);
    syncedVersionRef.current = settings.version;
  }, [settings, settingsFieldConfig, settingsSelfService]);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(draftFieldConfig) !==
        JSON.stringify(settingsFieldConfig) ||
      JSON.stringify(draftSelfService) !== JSON.stringify(settingsSelfService),
    [
      draftFieldConfig,
      draftSelfService,
      settingsFieldConfig,
      settingsSelfService,
    ]
  );

  const handleToggle = (
    fieldKey: EmployeeFieldKey,
    property: keyof FieldConfigDto,
    nextValue: boolean
  ) => {
    if (isTenantContextReadOnly) {
      return;
    }

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

  const handleSelfServiceToggle = (
    property: keyof typeof DEFAULT_SELF_SERVICE_SETTINGS,
    nextValue: boolean
  ) => {
    if (isTenantContextReadOnly) {
      return;
    }

    setDraftSelfService((current) => ({
      ...current,
      [property]: nextValue,
    }));
    setSaveError(null);
  };

  const handleReset = () => {
    if (isTenantContextReadOnly) {
      return;
    }

    setDraftFieldConfig(settingsFieldConfig);
    setDraftSelfService(settingsSelfService);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!settings || isTenantContextReadOnly) {
      return;
    }

    try {
      await updateSettings.mutateAsync({
        expectedVersion: settings.version,
        input: {
          employeeFieldConfig: buildEmployeeFieldConfigInput(draftFieldConfig),
          selfService: draftSelfService,
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

  if (error && !settings) {
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

  if (isLoading && !settings) {
    return <SettingsPageSkeleton />;
  }

  if (!settings) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Core Configuration"
        actions={
          <Button variant="outline" onClick={() => router.push(setupHref)}>
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
                    Configure the supported employee fields used across Core
                    records, imports, and profile editing.
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
                      <TableHead className="min-w-40">Status • rule</TableHead>
                      <TableHead className="text-center">
                        Visible in Core
                      </TableHead>
                      <TableHead className="text-center">Required</TableHead>
                      <TableHead className="text-center">
                        Visible to employee
                      </TableHead>
                      <TableHead className="text-center">
                        Visible to manager
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ACTIVE_EMPLOYEE_FIELD_DEFINITIONS.map((field) => {
                      const Icon = FIELD_ICONS[field.key];
                      const config = draftFieldConfig[field.key];
                      const ruleBadges = getFieldRuleBadges(field, config);
                      const hrAdminLocked = field.locked || config.required;
                      const audienceLocked =
                        isTenantContextReadOnly ||
                        field.locked ||
                        !config.visible;

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
                              disabled={
                                isTenantContextReadOnly || hrAdminLocked
                              }
                              ariaLabel={`${field.label} visible in Core`}
                              onCheckedChange={(checked) =>
                                handleToggle(field.key, "visible", checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <MatrixSwitch
                              checked={config.required}
                              disabled={
                                isTenantContextReadOnly ||
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
                              checked={config.visibleToEmployee}
                              disabled={audienceLocked}
                              ariaLabel={`${field.label} visible to employees`}
                              onCheckedChange={(checked) =>
                                handleToggle(
                                  field.key,
                                  "visibleToEmployee",
                                  checked
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <MatrixSwitch
                              checked={config.visibleToManager}
                              disabled={audienceLocked}
                              ariaLabel={`${field.label} visible to managers`}
                              onCheckedChange={(checked) =>
                                handleToggle(
                                  field.key,
                                  "visibleToManager",
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

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {isTenantContextReadOnly
                    ? "Read-only view — settings cannot be modified."
                    : hasChanges
                      ? "Changes are ready to save."
                      : "No unsaved changes."}
                </p>
                {!isTenantContextReadOnly ? (
                  <>
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
                      {updateSettings.isLoading
                        ? "Saving..."
                        : "Save field rules"}
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <div className="space-y-1">
                <CardTitle>Self-service editing</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Control which personal fields employees can update from their
                  own profile workspace.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-medium">Preferred name</h3>
                      <p className="text-sm text-muted-foreground">
                        Let employees update their preferred display name.
                      </p>
                    </div>
                    <Switch
                      checked={draftSelfService.canEditPreferredName}
                      disabled={isTenantContextReadOnly}
                      aria-label="Allow employees to edit preferred name"
                      onCheckedChange={(checked) =>
                        handleSelfServiceToggle("canEditPreferredName", checked)
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-medium">Phone</h3>
                      <p className="text-sm text-muted-foreground">
                        Let employees keep their own contact number up to date.
                      </p>
                    </div>
                    <Switch
                      checked={draftSelfService.canEditPhone}
                      disabled={isTenantContextReadOnly}
                      aria-label="Allow employees to edit phone"
                      onCheckedChange={(checked) =>
                        handleSelfServiceToggle("canEditPhone", checked)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Managers can view direct-report profiles within their existing
                team scope. Field-level visibility for employees and managers is
                controlled from the matrix above.
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
                {isOrgStructureEditable ? (
                  <DraftOrgUnitKindManager
                    schema={settings.draftStructureSchema}
                    existingUnits={[]}
                    disabled={isTenantContextReadOnly}
                    triggerLabel="Manage org-unit kinds"
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(setupHref)}
                  >
                    Open setup
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {setupState ? (
                  <SetupStatusBadge status={setupState.currentPhase} />
                ) : null}
                {!isOrgStructureEditable ? (
                  <Badge variant="outline">Managed in Setup</Badge>
                ) : isTenantContextReadOnly ? (
                  <Badge variant="outline">Read-only</Badge>
                ) : (
                  <Badge variant="secondary">Editable now</Badge>
                )}
              </div>

              {!isOrgStructureEditable ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Org-unit kinds are managed from the active setup draft. Open
                  Setup to make changes.
                </div>
              ) : isTenantContextReadOnly ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Org-unit kinds are visible here, but tenant-context browsing
                  is read-only.
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
            <CardTitle>Live access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                title: "PlatformAdmin",
                icon: ShieldCheck,
                body: "Tenant and platform lifecycle oversight.",
              },
              {
                title: "HRAdmin",
                icon: Users,
                body: "Workforce configuration, profile management, access invitations, imports, and org chart operations.",
              },
              {
                title: "Manager",
                icon: ShieldCheck,
                body: "Direct-report profile viewing within manager scope, subject to field-visibility rules.",
              },
              {
                title: "Employee",
                icon: UserRound,
                body: "Own-profile visibility with self-service editing governed by the settings above.",
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
