"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  ClipboardList,
  History,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  ApiError,
  type FieldConfigDto,
  type PeopleDataSettingsDto,
  type ProvisioningSettingsDto,
  type SettingsAuditEventDto,
  type SettingsSectionDto,
} from "@repo/api";
import { toast } from "sonner";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccessProfilesWorkspace } from "@/features/access/components/access-profiles-workspace";
import {
  useAccessAudit,
  useAccessProfiles,
} from "@/features/access/api/use-core-access";
import {
  useOrganizationSettings,
  usePeopleDataSettings,
  useProvisioningSettings,
  useSettingsAudit,
  useSettingsSections,
  useUpdateOrganizationSettings,
  useUpdatePeopleDataSettings,
  useUpdateProvisioningSettings,
} from "@/features/settings/api/use-tenant-settings";
import {
  normalizeSettingsSectionId,
  SETTINGS_SECTION_IDS,
  type SettingsSectionId,
} from "@/features/settings/settings-registry";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import {
  ACTIVE_EMPLOYEE_FIELD_DEFINITIONS,
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

const SETTINGS_NAV_ITEMS: Partial<
  Record<SettingsSectionId, { label: string; icon: LucideIcon }>
> = {
  [SETTINGS_SECTION_IDS.organization]: {
    label: "Company",
    icon: Building2,
  },
  [SETTINGS_SECTION_IDS.peopleData]: {
    label: "Employee fields",
    icon: ClipboardList,
  },
  [SETTINGS_SECTION_IDS.accessPermissions]: {
    label: "Access profiles",
    icon: ShieldCheck,
  },
  [SETTINGS_SECTION_IDS.provisioning]: {
    label: "Invitations",
    icon: Send,
  },
  [SETTINGS_SECTION_IDS.governance]: {
    label: "Audit log",
    icon: History,
  },
};

const DEFAULT_BRANDING = {
  logoUrl: "",
  primaryColor: "#1a365d",
};

const DEFAULT_SELF_SERVICE = {
  canEditPreferredName: true,
  canEditPhone: true,
};

type BrandingDraft = typeof DEFAULT_BRANDING;
type ProvisioningDraft = {
  defaultAccessProfileId: string;
  inviteExpiryDays: number;
  resendCooldownHours: number;
  pendingInviteBehavior: string;
};

const DEFAULT_PROVISIONING: ProvisioningDraft = {
  defaultAccessProfileId: "none",
  inviteExpiryDays: 14,
  resendCooldownHours: 24,
  pendingInviteBehavior: "RefreshExisting",
};

type AuditRow = {
  id: string;
  source: "Settings" | "Access";
  occurredAt: string;
  actorName: string | null;
  action: string;
  summary: string;
  resourceType: string;
  beforeJson: string | null;
  afterJson: string | null;
};

function buildSettingsErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return "This configuration changed while you were editing it. Reload the section and apply your change again.";
    }

    return error.errors.join(", ") || "The configuration update failed.";
  }

  return "The configuration update failed.";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildBrandingDraft(settings?: {
  branding?: { logoUrl: string | null; primaryColor: string | null };
} | null): BrandingDraft {
  return {
    logoUrl: settings?.branding?.logoUrl ?? DEFAULT_BRANDING.logoUrl,
    primaryColor:
      settings?.branding?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
  };
}

function buildBrandingInput(branding: BrandingDraft) {
  return {
    logoUrl: branding.logoUrl.trim() || null,
    primaryColor: branding.primaryColor.trim() || DEFAULT_BRANDING.primaryColor,
  };
}

function buildPeopleFieldConfigDraft(
  settings?: PeopleDataSettingsDto | null
): EmployeeFieldConfigMap {
  return ACTIVE_EMPLOYEE_FIELD_DEFINITIONS.reduce((config, field) => {
    const nextConfig =
      settings?.employeeFieldConfig[field.key] ?? field.defaultConfig;
    const required = field.requiredLocked === true ? true : nextConfig.required;

    config[field.key] = {
      ...nextConfig,
      visible: field.locked || required ? true : nextConfig.visible,
      required,
      visibleToEmployee: nextConfig.visibleToEmployee,
      visibleToManager: nextConfig.visibleToManager,
    };

    return config;
  }, {} as EmployeeFieldConfigMap);
}

function buildDefaultPeopleFieldConfigDraft(): EmployeeFieldConfigMap {
  return ACTIVE_EMPLOYEE_FIELD_DEFINITIONS.reduce((config, field) => {
    config[field.key] = {
      ...field.defaultConfig,
      visible: true,
      required:
        field.requiredLocked === true
          ? true
          : field.defaultConfig.required,
    };
    return config;
  }, {} as EmployeeFieldConfigMap);
}

function buildProvisioningDraft(
  provisioning?: ProvisioningSettingsDto | null
): ProvisioningDraft {
  return {
    defaultAccessProfileId:
      provisioning?.defaultAccessProfileId ?? DEFAULT_PROVISIONING.defaultAccessProfileId,
    inviteExpiryDays:
      provisioning?.inviteExpiryDays ?? DEFAULT_PROVISIONING.inviteExpiryDays,
    resendCooldownHours:
      provisioning?.resendCooldownHours ??
      DEFAULT_PROVISIONING.resendCooldownHours,
    pendingInviteBehavior:
      provisioning?.pendingInviteBehavior ??
      DEFAULT_PROVISIONING.pendingInviteBehavior,
  };
}

function buildProvisioningInput(draft: ProvisioningDraft) {
  return {
    defaultAccessProfileId:
      draft.defaultAccessProfileId === "none" ? null : draft.defaultAccessProfileId,
    inviteExpiryDays: draft.inviteExpiryDays,
    resendCooldownHours: draft.resendCooldownHours,
    pendingInviteBehavior: draft.pendingInviteBehavior,
  };
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

function isActionableSettingsSectionId(id: string): id is SettingsSectionId {
  return (
    Object.prototype.hasOwnProperty.call(SETTINGS_NAV_ITEMS, id) &&
    SETTINGS_NAV_ITEMS[id as SettingsSectionId] !== undefined
  );
}

function buildSettingsTabHref(
  sectionId: SettingsSectionId,
  searchParams: { toString: () => string }
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", sectionId);
  return `?${params.toString()}`;
}

function SettingsPageSkeleton() {
  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Settings"
        description={<Skeleton className="h-4 w-80 max-w-full" />}
      />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-136 rounded-xl" />
      </div>
    </PageContainer>
  );
}

function SectionSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 rounded-xl" />
      </CardContent>
    </Card>
  );
}

function SectionError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Failed to load this section</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{buildSettingsErrorMessage(error)}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function SaveBar({
  canManage,
  hasChanges,
  isSaving,
  error,
  onReset,
  onSave,
  onReload,
}: {
  canManage: boolean;
  hasChanges: boolean;
  isSaving: boolean;
  error: string | null;
  onReset: () => void;
  onSave: () => void;
  onReload: () => void;
}) {
  const showActions = canManage && hasChanges;

  if (!error && !showActions) {
    return null;
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Save failed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={onReload}>
              Reload
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {showActions ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={onReset}
          >
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function mergeAuditRows(
  settingsEvents: SettingsAuditEventDto[] | undefined,
  accessEvents:
    | Array<{
        id: string;
        occurredAt: string;
        actorName: string | null;
        action: string;
        summary: string;
        resourceType: string;
        beforeJson: string | null;
        afterJson: string | null;
      }>
    | undefined
): AuditRow[] {
  return [
    ...(settingsEvents ?? []).map((event) => ({
      id: `settings-${event.id}`,
      source: "Settings" as const,
      occurredAt: event.occurredAt,
      actorName: event.actorName,
      action: event.action,
      summary: event.summary,
      resourceType: event.resourceType,
      beforeJson: event.beforeJson,
      afterJson: event.afterJson,
    })),
    ...(accessEvents ?? []).map((event) => ({
      id: `access-${event.id}`,
      source: "Access" as const,
      occurredAt: event.occurredAt,
      actorName: event.actorName,
      action: event.action,
      summary: event.summary,
      resourceType: event.resourceType,
      beforeJson: event.beforeJson,
      afterJson: event.afterJson,
    })),
  ].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  );
}

function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
        No settings or access profile changes have been recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Actor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDateTime(row.occurredAt)}
              </TableCell>
              <TableCell>
                <span className="text-sm">{row.source}</span>
              </TableCell>
              <TableCell className="text-sm">{row.action}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{row.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.resourceType}
                    {row.beforeJson || row.afterJson
                      ? " - before and after captured"
                      : ""}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.actorName ?? "System"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SettingsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId, tenantSlug, tenantName } = useTenantContext();
  const setupHref = buildTenantContextHref("/setup", tenantId, tenantSlug);
  const requestedTab = searchParams.get("tab");
  const requestedSectionId = normalizeSettingsSectionId(requestedTab);

  const sectionsQuery = useSettingsSections();
  const sections = useMemo<SettingsSectionDto[]>(
    () => (sectionsQuery.data ?? []).slice().sort((left, right) => left.order - right.order),
    [sectionsQuery.data]
  );
  const actionableSections = useMemo(
    () =>
      sections.filter((section) => isActionableSettingsSectionId(section.id)),
    [sections]
  );
  const sectionMap = useMemo(
    () => new Map(actionableSections.map((section) => [section.id, section])),
    [actionableSections]
  );
  const visibleActionableSectionIds = useMemo(
    () => actionableSections.map((section) => section.id as SettingsSectionId),
    [actionableSections]
  );

  const activeSectionId = useMemo<SettingsSectionId | null>(() => {
    if (
      requestedSectionId &&
      visibleActionableSectionIds.includes(requestedSectionId)
    ) {
      return requestedSectionId;
    }

    return (
      (actionableSections[0]?.id as SettingsSectionId | undefined) ?? null
    );
  }, [actionableSections, requestedSectionId, visibleActionableSectionIds]);

  useEffect(() => {
    if (sectionsQuery.isLoading) {
      return;
    }

    if (requestedSectionId === SETTINGS_SECTION_IDS.structure) {
      router.replace(setupHref, { scroll: false });
      return;
    }

    if (!activeSectionId || actionableSections.length === 0 || !requestedTab) {
      return;
    }

    if (requestedSectionId !== activeSectionId) {
      router.replace(buildSettingsTabHref(activeSectionId, searchParams), {
        scroll: false,
      });
    }
  }, [
    activeSectionId,
    actionableSections.length,
    requestedSectionId,
    requestedTab,
    router,
    searchParams,
    sectionsQuery.isLoading,
    setupHref,
  ]);

  const activeSection = activeSectionId ? sectionMap.get(activeSectionId) : undefined;
  const activeCanManage = activeSection?.canManage === true;
  const activeNavItem = activeSectionId
    ? SETTINGS_NAV_ITEMS[activeSectionId]
    : undefined;

  const organizationQuery = useOrganizationSettings(
    activeSectionId === SETTINGS_SECTION_IDS.organization
  );
  const peopleQuery = usePeopleDataSettings(
    activeSectionId === SETTINGS_SECTION_IDS.peopleData
  );
  const provisioningQuery = useProvisioningSettings(
    activeSectionId === SETTINGS_SECTION_IDS.provisioning
  );
  const settingsAuditQuery = useSettingsAudit(
    activeSectionId === SETTINGS_SECTION_IDS.governance
  );
  const accessAuditQuery = useAccessAudit(
    activeSectionId === SETTINGS_SECTION_IDS.governance
  );
  const accessProfilesQuery = useAccessProfiles(
    activeSectionId === SETTINGS_SECTION_IDS.provisioning
  );

  const [draftBranding, setDraftBranding] =
    useState<BrandingDraft>(DEFAULT_BRANDING);
  const [draftFieldConfig, setDraftFieldConfig] =
    useState<EmployeeFieldConfigMap>(buildDefaultPeopleFieldConfigDraft);
  const [draftSelfService, setDraftSelfService] =
    useState(DEFAULT_SELF_SERVICE);
  const [draftProvisioning, setDraftProvisioning] =
    useState<ProvisioningDraft>(DEFAULT_PROVISIONING);
  const [saveError, setSaveError] = useState<string | null>(null);
  const organizationVersionRef = useRef<number | null | undefined>(undefined);
  const peopleVersionRef = useRef<number | null | undefined>(undefined);
  const provisioningVersionRef = useRef<number | null | undefined>(undefined);

  const updateOrganization = useUpdateOrganizationSettings({
    onSuccess: (data) => {
      organizationVersionRef.current = data.version;
      setDraftBranding(buildBrandingDraft(data));
      setSaveError(null);
      toast.success("Organization settings updated.");
    },
  });
  const updatePeopleData = useUpdatePeopleDataSettings({
    onSuccess: (data) => {
      peopleVersionRef.current = data.version;
      setDraftFieldConfig(buildPeopleFieldConfigDraft(data));
      setDraftSelfService(data.selfService);
      setSaveError(null);
      toast.success("People data settings updated.");
    },
  });
  const updateProvisioning = useUpdateProvisioningSettings({
    onSuccess: (data) => {
      provisioningVersionRef.current = data.version;
      setDraftProvisioning(buildProvisioningDraft(data.provisioning));
      setSaveError(null);
      toast.success("Provisioning settings updated.");
    },
  });

  const organizationSettings = organizationQuery.data;
  const peopleSettings = peopleQuery.data;
  const provisioningSettings = provisioningQuery.data;

  const persistedBranding = useMemo(
    () => buildBrandingDraft(organizationSettings),
    [organizationSettings]
  );
  const persistedFieldConfig = useMemo(
    () => buildPeopleFieldConfigDraft(peopleSettings),
    [peopleSettings]
  );
  const persistedSelfService = useMemo(
    () => peopleSettings?.selfService ?? DEFAULT_SELF_SERVICE,
    [peopleSettings]
  );
  const persistedProvisioning = useMemo(
    () => buildProvisioningDraft(provisioningSettings?.provisioning),
    [provisioningSettings]
  );

  useEffect(() => {
    setSaveError(null);
  }, [activeSectionId]);

  useEffect(() => {
    if (!organizationSettings) {
      return;
    }

    if (organizationVersionRef.current === organizationSettings.version) {
      return;
    }

    setDraftBranding(persistedBranding);
    organizationVersionRef.current = organizationSettings.version;
  }, [organizationSettings, persistedBranding]);

  useEffect(() => {
    if (!peopleSettings) {
      return;
    }

    if (peopleVersionRef.current === peopleSettings.version) {
      return;
    }

    setDraftFieldConfig(persistedFieldConfig);
    setDraftSelfService(persistedSelfService);
    peopleVersionRef.current = peopleSettings.version;
  }, [peopleSettings, persistedFieldConfig, persistedSelfService]);

  useEffect(() => {
    if (!provisioningSettings) {
      return;
    }

    if (provisioningVersionRef.current === provisioningSettings.version) {
      return;
    }

    setDraftProvisioning(persistedProvisioning);
    provisioningVersionRef.current = provisioningSettings.version;
  }, [provisioningSettings, persistedProvisioning]);

  const organizationHasChanges =
    JSON.stringify(draftBranding) !== JSON.stringify(persistedBranding);
  const peopleHasChanges =
    JSON.stringify(draftFieldConfig) !== JSON.stringify(persistedFieldConfig) ||
    JSON.stringify(draftSelfService) !== JSON.stringify(persistedSelfService);
  const provisioningHasChanges =
    JSON.stringify(draftProvisioning) !==
    JSON.stringify(persistedProvisioning);

  const handleSectionChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleToggle = (
    fieldKey: EmployeeFieldKey,
    property: keyof FieldConfigDto,
    nextValue: boolean
  ) => {
    if (!activeCanManage) {
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

      return next;
    });
    setSaveError(null);
  };

  const handleSaveOrganization = async () => {
    if (!organizationSettings || !activeCanManage) {
      return;
    }

    try {
      await updateOrganization.mutateAsync({
        expectedVersion: organizationSettings.version,
        input: { branding: buildBrandingInput(draftBranding) },
      });
    } catch (error) {
      const message = buildSettingsErrorMessage(error);
      setSaveError(message);
      toast.error(message);
    }
  };

  const handleSavePeopleData = async () => {
    if (!peopleSettings || !activeCanManage) {
      return;
    }

    try {
      await updatePeopleData.mutateAsync({
        expectedVersion: peopleSettings.version,
        input: {
          employeeFieldConfig: buildEmployeeFieldConfigInput(draftFieldConfig),
          selfService: draftSelfService,
        },
      });
    } catch (error) {
      const message = buildSettingsErrorMessage(error);
      setSaveError(message);
      toast.error(message);
    }
  };

  const handleSaveProvisioning = async () => {
    if (!provisioningSettings || !activeCanManage) {
      return;
    }

    try {
      await updateProvisioning.mutateAsync({
        expectedVersion: provisioningSettings.version,
        input: { provisioning: buildProvisioningInput(draftProvisioning) },
      });
    } catch (error) {
      const message = buildSettingsErrorMessage(error);
      setSaveError(message);
      toast.error(message);
    }
  };

  if (sectionsQuery.isLoading && sections.length === 0) {
    return <SettingsPageSkeleton />;
  }

  if (sectionsQuery.error && sections.length === 0) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Settings" />
        <SectionError
          error={sectionsQuery.error}
          onRetry={() => void sectionsQuery.refetch()}
        />
      </PageContainer>
    );
  }

  if (actionableSections.length === 0) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader title="Settings" />
        <PagePermissionNotice
          title="Settings are restricted"
          description="No tenant administration capabilities are available for this account."
        />
      </PageContainer>
    );
  }

  const visibleAccessProfiles = accessProfilesQuery.data ?? [];
  const currentDefaultProfileId = draftProvisioning.defaultAccessProfileId;
  const defaultProfileOptions =
    currentDefaultProfileId !== "none" &&
    !visibleAccessProfiles.some((profile) => profile.id === currentDefaultProfileId)
      ? [
          {
            id: currentDefaultProfileId,
            name: `Current profile ${currentDefaultProfileId.slice(0, 8)}`,
          },
          ...visibleAccessProfiles,
        ]
      : visibleAccessProfiles;

  const auditRows = mergeAuditRows(
    settingsAuditQuery.data,
    accessAuditQuery.data
  );

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Settings"
        description={
          tenantName
            ? `Administration for ${tenantName}.`
            : "Tenant administration, governance, and safe defaults."
        }
        actions={
          sections.some((section) => section.id === SETTINGS_SECTION_IDS.structure) ? (
            <Button variant="outline" onClick={() => router.push(setupHref)}>
              Open setup
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-w-0">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {actionableSections.map((section) => {
              const navItem = SETTINGS_NAV_ITEMS[section.id as SettingsSectionId];

              if (!navItem) {
                return null;
              }

              const Icon = navItem.icon;
              const isActive = section.id === activeSectionId;

              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => handleSectionChange(section.id)}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{navItem.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="space-y-6">
          {activeSection ? (
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {activeNavItem?.label ?? activeSection.label}
              </h2>
            </div>
          ) : null}

          {activeSectionId === SETTINGS_SECTION_IDS.organization ? (
            organizationQuery.isLoading ? (
              <SectionSkeleton />
            ) : organizationQuery.error ? (
              <SectionError
                error={organizationQuery.error}
                onRetry={() => void organizationQuery.refetch()}
              />
            ) : organizationSettings ? (
              <Card>
                <CardHeader density="compact">
                  <CardTitle>Company</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Company name
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {tenantName ??
                          organizationSettings.displayName ??
                          "Current organization"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Locale
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {organizationSettings.locale}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Timezone
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {organizationSettings.timeZone}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="organization-primary-color">
                        Primary color
                      </Label>
                      <Input
                        id="organization-primary-color"
                        value={draftBranding.primaryColor}
                        disabled={!activeCanManage}
                        placeholder="#1a365d"
                        onChange={(event) => {
                          setDraftBranding((current) => ({
                            ...current,
                            primaryColor: event.target.value,
                          }));
                          setSaveError(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organization-logo-url">Logo URL</Label>
                      <Input
                        id="organization-logo-url"
                        value={draftBranding.logoUrl}
                        disabled={!activeCanManage}
                        placeholder="https://example.com/logo.svg"
                        onChange={(event) => {
                          setDraftBranding((current) => ({
                            ...current,
                            logoUrl: event.target.value,
                          }));
                          setSaveError(null);
                        }}
                      />
                    </div>
                  </div>

                  <SaveBar
                    canManage={activeCanManage}
                    hasChanges={organizationHasChanges}
                    isSaving={updateOrganization.isLoading}
                    error={saveError}
                    onReset={() => {
                      setDraftBranding(persistedBranding);
                      setSaveError(null);
                    }}
                    onSave={() => void handleSaveOrganization()}
                    onReload={() => void organizationQuery.refetch()}
                  />
                </CardContent>
              </Card>
            ) : null
          ) : null}

          {activeSectionId === SETTINGS_SECTION_IDS.peopleData ? (
            peopleQuery.isLoading ? (
              <SectionSkeleton />
            ) : peopleQuery.error ? (
              <SectionError
                error={peopleQuery.error}
                onRetry={() => void peopleQuery.refetch()}
              />
            ) : peopleSettings ? (
              <Card>
                <CardHeader density="compact">
                  <CardTitle>Employee fields</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-36">Field</TableHead>
                          <TableHead className="text-center">
                            Enabled
                          </TableHead>
                          <TableHead className="text-center">
                            Required
                          </TableHead>
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
                          const fieldLocked = field.locked || config.required;
                          const audienceLocked = field.locked || !config.visible;

                          return (
                            <TableRow key={field.key}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">
                                      {field.label}
                                    </p>
                                    {config.required ? (
                                      <p className="text-xs text-muted-foreground">
                                        Required
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <MatrixSwitch
                                  checked={config.visible}
                                  disabled={!activeCanManage || fieldLocked}
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
                                    !activeCanManage ||
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
                                  disabled={!activeCanManage || audienceLocked}
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
                                  disabled={!activeCanManage || audienceLocked}
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

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Self-service editing</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm">
                        <span>Preferred name</span>
                        <Switch
                          checked={draftSelfService.canEditPreferredName}
                          disabled={!activeCanManage}
                          onCheckedChange={(checked) => {
                            setDraftSelfService((current) => ({
                              ...current,
                              canEditPreferredName: checked,
                            }));
                            setSaveError(null);
                          }}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm">
                        <span>Phone</span>
                        <Switch
                          checked={draftSelfService.canEditPhone}
                          disabled={!activeCanManage}
                          onCheckedChange={(checked) => {
                            setDraftSelfService((current) => ({
                              ...current,
                              canEditPhone: checked,
                            }));
                            setSaveError(null);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <SaveBar
                    canManage={activeCanManage}
                    hasChanges={peopleHasChanges}
                    isSaving={updatePeopleData.isLoading}
                    error={saveError}
                    onReset={() => {
                      setDraftFieldConfig(persistedFieldConfig);
                      setDraftSelfService(persistedSelfService);
                      setSaveError(null);
                    }}
                    onSave={() => void handleSavePeopleData()}
                    onReload={() => void peopleQuery.refetch()}
                  />
                </CardContent>
              </Card>
            ) : null
          ) : null}

          {activeSectionId === SETTINGS_SECTION_IDS.accessPermissions ? (
            <AccessProfilesWorkspace embedded />
          ) : null}

          {activeSectionId === SETTINGS_SECTION_IDS.provisioning ? (
            provisioningQuery.isLoading ? (
              <SectionSkeleton />
            ) : provisioningQuery.error ? (
              <SectionError
                error={provisioningQuery.error}
                onRetry={() => void provisioningQuery.refetch()}
              />
            ) : provisioningSettings ? (
              <Card>
                <CardHeader density="compact">
                  <CardTitle>Invitations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="default-access-profile">
                        Default access profile for invites
                      </Label>
                      <Select
                        value={draftProvisioning.defaultAccessProfileId}
                        disabled={!activeCanManage}
                        onValueChange={(value) => {
                          setDraftProvisioning((current) => ({
                            ...current,
                            defaultAccessProfileId: value,
                          }));
                          setSaveError(null);
                        }}
                      >
                        <SelectTrigger id="default-access-profile">
                          <SelectValue placeholder="No default profile" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Require profile selection
                          </SelectItem>
                          {defaultProfileOptions.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {accessProfilesQuery.error ? (
                        <p className="text-xs text-muted-foreground">
                          Profile names could not be loaded. The saved profile
                          id is still preserved.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-expiry-days">
                        Invite expires after
                      </Label>
                      <Input
                        id="invite-expiry-days"
                        type="number"
                        min={1}
                        max={90}
                        value={draftProvisioning.inviteExpiryDays}
                        disabled={!activeCanManage}
                        onChange={(event) => {
                          setDraftProvisioning((current) => ({
                            ...current,
                            inviteExpiryDays: Number(event.target.value),
                          }));
                          setSaveError(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resend-cooldown-hours">
                        Resend cooldown
                      </Label>
                      <Input
                        id="resend-cooldown-hours"
                        type="number"
                        min={0}
                        max={720}
                        value={draftProvisioning.resendCooldownHours}
                        disabled={!activeCanManage}
                        onChange={(event) => {
                          setDraftProvisioning((current) => ({
                            ...current,
                            resendCooldownHours: Number(event.target.value),
                          }));
                          setSaveError(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pending-invite-behavior">
                        Pending invite handling
                      </Label>
                      <Select
                        value={draftProvisioning.pendingInviteBehavior}
                        disabled={!activeCanManage}
                        onValueChange={(value) => {
                          setDraftProvisioning((current) => ({
                            ...current,
                            pendingInviteBehavior: value,
                          }));
                          setSaveError(null);
                        }}
                      >
                        <SelectTrigger id="pending-invite-behavior">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RefreshExisting">
                            Refresh existing invite
                          </SelectItem>
                          <SelectItem value="KeepExisting">
                            Keep existing invite
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <SaveBar
                    canManage={activeCanManage}
                    hasChanges={provisioningHasChanges}
                    isSaving={updateProvisioning.isLoading}
                    error={saveError}
                    onReset={() => {
                      setDraftProvisioning(persistedProvisioning);
                      setSaveError(null);
                    }}
                    onSave={() => void handleSaveProvisioning()}
                    onReload={() => void provisioningQuery.refetch()}
                  />
                </CardContent>
              </Card>
            ) : null
          ) : null}

          {activeSectionId === SETTINGS_SECTION_IDS.governance ? (
            settingsAuditQuery.isLoading || accessAuditQuery.isLoading ? (
              <SectionSkeleton />
            ) : settingsAuditQuery.error ? (
              <SectionError
                error={settingsAuditQuery.error}
                onRetry={() => void settingsAuditQuery.refetch()}
              />
            ) : accessAuditQuery.error ? (
              <SectionError
                error={accessAuditQuery.error}
                onRetry={() => void accessAuditQuery.refetch()}
              />
            ) : (
              <Card>
                <CardHeader density="compact">
                  <CardTitle>Audit log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AuditTable rows={auditRows} />
                </CardContent>
              </Card>
            )
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
