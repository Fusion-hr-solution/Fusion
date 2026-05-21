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
  UserRound,
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
        <Skeleton className="h-4 w-[34rem] max-w-full" />
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-[20rem] max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[26rem] rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 rounded-xl" />
        </CardContent>
      </Card>
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
          title="Settings are HRAdmin-only"
          description="Contact an HR administrator."
        />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Core settings" />
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
        title="Core settings"
        actions={
          <Button variant="outline" onClick={() => router.push(setupHref)}>
            Open setup
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Employee fields</CardTitle>
          <p className="text-sm text-muted-foreground">
            Control field visibility across records, profiles, and imports.
          </p>
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

          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-36">Field</TableHead>
                  <TableHead className="min-w-32">Rule</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Required</TableHead>
                  <TableHead className="text-center">Employee</TableHead>
                  <TableHead className="text-center">Manager</TableHead>
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
                          disabled={isTenantContextReadOnly || hrAdminLocked}
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

          <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/20 px-4 py-3">
            <span className="text-sm font-medium">Profile editing</span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={draftSelfService.canEditPreferredName}
                disabled={isTenantContextReadOnly}
                onCheckedChange={(checked) =>
                  handleSelfServiceToggle("canEditPreferredName", checked)
                }
              />
              Preferred name
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={draftSelfService.canEditPhone}
                disabled={isTenantContextReadOnly}
                onCheckedChange={(checked) =>
                  handleSelfServiceToggle("canEditPhone", checked)
                }
              />
              Phone
            </label>
          </div>

          {hasChanges ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Unsaved changes
              </span>
              <div className="flex gap-2">
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
                  {updateSettings.isLoading ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
