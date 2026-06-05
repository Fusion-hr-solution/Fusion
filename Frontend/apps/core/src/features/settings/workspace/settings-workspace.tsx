"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ApiError, type FieldConfigDto } from "@repo/api";
import {
  canAccessCoreSettings,
  canManageCoreAccessProfiles,
  canManageCoreSettings,
  useAuth,
} from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { useCoreSetupAccess } from "@/shell/setup-access";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DraftOrgUnitKindManager } from "@/app/(pages)/setup/draft-structure/draft-org-unit-kind-manager";
import { SetupStatusBadge } from "@/app/(pages)/setup/setup-status-badge";
import {
  useTenantSettings,
  useUpdateTenantSettings,
} from "@/features/settings/api/use-tenant-settings";
import {
  ACTIVE_EMPLOYEE_FIELD_DEFINITIONS,
  buildEmployeeFieldConfigDraft,
  buildEmployeeFieldConfigInput,
  type EmployeeFieldConfigMap,
  type EmployeeFieldKey,
} from "@/features/employees/shared/employee-field-visibility";

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
    return error.errors.join(", ") || "The configuration update failed.";
  }

  return "The configuration update failed.";
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
      title: "Required for Core records.",
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
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-136 rounded-xl" />
        </CardHeader>
      </Card>
    </div>
  );
}

export default function SettingsWorkspace() {
  const router = useRouter();
  const { user } = useAuth();
  const { tenantId, tenantSlug, tenantName } = useTenantContext();
  const isTenantContext = !!tenantId;
  const setupHref = buildTenantContextHref("/setup", tenantId, tenantSlug);
  const accessProfilesHref = buildTenantContextHref(
    "/access/profiles",
    tenantId,
    tenantSlug
  );
  const searchParams = useSearchParams();

  const canViewConfiguration = canAccessCoreSettings(user) || isTenantContext;
  const canEditSettings = !isTenantContext && canManageCoreSettings(user);
  const canManageProfiles = canManageCoreAccessProfiles(user);

  const { setupState } = useCoreSetupAccess();
  const {
    data: settings,
    error,
    isLoading,
    refetch,
  } = useTenantSettings(canViewConfiguration);
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
  const isOrgStructureEditable =
    !!setupState && setupState.isDraftCycleActive && canEditSettings;

  const shouldRedirectToAccessProfiles =
    searchParams.get("tab") === "access-profiles" && canManageProfiles;

  const activeTab = useMemo(() => {
    const tabParam = searchParams.get("tab");

    if (tabParam === "organization-structure") {
      return "organization-structure";
    }

    if (tabParam === "employee-fields") {
      return "employee-fields";
    }

    return "employee-fields";
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

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

  const hasSettingsChanges = useMemo(
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
    if (!canEditSettings) {
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
    if (!canEditSettings) {
      return;
    }

    setDraftSelfService((current) => ({
      ...current,
      [property]: nextValue,
    }));
    setSaveError(null);
  };

  const handleResetSettings = () => {
    if (!canEditSettings) {
      return;
    }

    setDraftFieldConfig(settingsFieldConfig);
    setDraftSelfService(settingsSelfService);
    setSaveError(null);
  };

  const handleSaveSettings = async () => {
    if (!settings || !canEditSettings) {
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
      const message = buildSettingsErrorMessage(updateError);
      setSaveError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    if (shouldRedirectToAccessProfiles) {
      router.replace(accessProfilesHref);
    }
  }, [accessProfilesHref, router, shouldRedirectToAccessProfiles]);

  if (shouldRedirectToAccessProfiles) {
    return <SettingsPageSkeleton />;
  }

  if (!canViewConfiguration) {
    return (
      <div className="p-6">
        <EmptyState
          icon={LockKeyhole}
          title="Core configuration is restricted"
          description="Ask a tenant administrator to grant access."
        />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Settings" />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load settings</AlertTitle>
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
        title="Settings"
        description={
          isTenantContext
            ? `Read-only view for ${tenantName ?? "tenant"}.`
            : "Employee fields and organization structure."
        }
        actions={
          <Button variant="outline" onClick={() => router.push(setupHref)}>
            Open setup
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-[360px]">
          <TabsTrigger value="employee-fields">Employee fields</TabsTrigger>
          <TabsTrigger value="organization-structure">
            Organization structure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employee-fields" className="space-y-6">
          <Card>
            <CardHeader density="compact">
              <CardTitle>Employee fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {saveError ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Configuration update failed</AlertTitle>
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                <Badge variant="outline">Self-service first</Badge>
                <span>Use the matrix for field visibility and requirements.</span>
              </div>

              <details className="overflow-hidden rounded-xl border" open={hasSettingsChanges}>
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                  Field visibility and requirements
                </summary>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-36">Field</TableHead>
                      <TableHead className="min-w-32">Rule</TableHead>
                      <TableHead className="text-center">
                        Field enabled
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
                      const audienceLocked = field.locked || !config.visible;

                      return (
                        <TableRow key={field.key}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="size-4 shrink-0 text-muted-foreground" />
                              <span className="font-medium">{field.label}</span>
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
                              disabled={!canEditSettings || hrAdminLocked}
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
                                !canEditSettings ||
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
                              disabled={!canEditSettings || audienceLocked}
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
                              disabled={!canEditSettings || audienceLocked}
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
              </details>

              <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/20 px-4 py-3">
                <span className="text-sm font-medium">
                  Self-service editing
                </span>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={draftSelfService.canEditPreferredName}
                    disabled={!canEditSettings}
                    onCheckedChange={(checked) =>
                      handleSelfServiceToggle("canEditPreferredName", checked)
                    }
                  />
                  Preferred name
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={draftSelfService.canEditPhone}
                    disabled={!canEditSettings}
                    onCheckedChange={(checked) =>
                      handleSelfServiceToggle("canEditPhone", checked)
                    }
                  />
                  Phone
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {hasSettingsChanges
                    ? "Unsaved changes"
                    : canEditSettings
                      ? null
                      : "Read-only"}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={!canEditSettings || !hasSettingsChanges}
                    onClick={handleResetSettings}
                  >
                    Reset
                  </Button>
                  <Button
                    disabled={
                      !canEditSettings ||
                      !hasSettingsChanges ||
                      updateSettings.isLoading
                    }
                    onClick={handleSaveSettings}
                  >
                    {updateSettings.isLoading ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization-structure" className="space-y-6">
          <Card>
            <CardHeader density="compact">
              <CardTitle>Organization structure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {setupState ? (
                  <SetupStatusBadge setupState={setupState} />
                ) : null}
                {isOrgStructureEditable ? (
                  <Badge variant="secondary">Editable now</Badge>
                ) : (
                  <Badge variant="outline">Managed in Setup</Badge>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/10 px-4 py-3">
                <p className="text-sm font-medium">Org-unit kinds</p>
                {isOrgStructureEditable ? (
                  <DraftOrgUnitKindManager
                    schema={settings.draftStructureSchema}
                    existingUnits={[]}
                    disabled={false}
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

              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.draftStructureSchema.orgUnitKinds.map((kind) => (
                      <TableRow key={kind.key}>
                        <TableCell className="font-medium">
                          {kind.displayLabel}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
