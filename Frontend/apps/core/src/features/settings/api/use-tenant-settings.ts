"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  tenantSettingsQueryKeys,
  tenantSettingsPaths,
  type OrganizationSettingsDto,
  type PeopleDataSettingsDto,
  type ProvisioningSettingsResponseDto,
  type SettingsAuditEventDto,
  type SettingsOverviewDto,
  type SettingsSectionDto,
  type TenantSettingsDto,
  type UpdateTenantSettingsRequest,
} from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

interface UpdateTenantSettingsArgs {
  expectedVersion: number | null;
  input: UpdateTenantSettingsRequest;
}

interface UpdateOrganizationSettingsArgs {
  expectedVersion: number | null;
  input: Pick<UpdateTenantSettingsRequest, "branding">;
}

interface UpdatePeopleDataSettingsArgs {
  expectedVersion: number | null;
  input: Pick<UpdateTenantSettingsRequest, "employeeFieldConfig" | "selfService">;
}

interface UpdateProvisioningSettingsArgs {
  expectedVersion: number | null;
  input: Pick<UpdateTenantSettingsRequest, "provisioning">;
}

function buildIfMatchHeaders(expectedVersion: number | null) {
  return expectedVersion == null
    ? undefined
    : { "If-Match": `"${expectedVersion}"` };
}

export function useTenantSettings(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<TenantSettingsDto>(tenantSettingsPaths.current(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(tenantSettingsQueryKeys.current(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useSettingsSections(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<SettingsSectionDto[]>(tenantSettingsPaths.sections(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(tenantSettingsQueryKeys.sections(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useSettingsOverview(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<SettingsOverviewDto>(tenantSettingsPaths.overview(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(tenantSettingsQueryKeys.overview(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useOrganizationSettings(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<OrganizationSettingsDto>(tenantSettingsPaths.organization(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(tenantSettingsQueryKeys.organization(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function usePeopleDataSettings(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<PeopleDataSettingsDto>(tenantSettingsPaths.peopleData(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(tenantSettingsQueryKeys.peopleData(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useProvisioningSettings(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<ProvisioningSettingsResponseDto>(
        tenantSettingsPaths.provisioning(),
        {
          signal,
        }
      ),
    [client]
  );

  return useApiQuery(tenantSettingsQueryKeys.provisioning(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useSettingsAudit(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<SettingsAuditEventDto[]>(tenantSettingsPaths.audit(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(tenantSettingsQueryKeys.audit(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useUpdateTenantSettings(opts?: {
  onSuccess?: (data: TenantSettingsDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSettingsDto, UpdateTenantSettingsArgs>(
    ({ expectedVersion, input }) =>
      client.patch<TenantSettingsDto>(tenantSettingsPaths.current(), input, {
        headers: buildIfMatchHeaders(expectedVersion),
      }),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(tenantSettingsQueryKeys.current(), data);
        await queryClient.invalidateQueries({
          queryKey: tenantSettingsQueryKeys.sections(),
        });
        await queryClient.invalidateQueries({
          queryKey: tenantSettingsQueryKeys.overview(),
        });
        await queryClient.invalidateQueries({
          queryKey: tenantSettingsQueryKeys.audit(),
        });
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useUpdateOrganizationSettings(opts?: {
  onSuccess?: (data: OrganizationSettingsDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<OrganizationSettingsDto, UpdateOrganizationSettingsArgs>(
    ({ expectedVersion, input }) =>
      client.patch<OrganizationSettingsDto>(
        tenantSettingsPaths.organization(),
        input,
        { headers: buildIfMatchHeaders(expectedVersion) }
      ),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(tenantSettingsQueryKeys.organization(), data);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.current(),
          }),
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.overview(),
          }),
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.audit(),
          }),
        ]);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useUpdatePeopleDataSettings(opts?: {
  onSuccess?: (data: PeopleDataSettingsDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<PeopleDataSettingsDto, UpdatePeopleDataSettingsArgs>(
    ({ expectedVersion, input }) =>
      client.patch<PeopleDataSettingsDto>(
        tenantSettingsPaths.peopleData(),
        input,
        { headers: buildIfMatchHeaders(expectedVersion) }
      ),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(tenantSettingsQueryKeys.peopleData(), data);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.current(),
          }),
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.overview(),
          }),
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.audit(),
          }),
        ]);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useUpdateProvisioningSettings(opts?: {
  onSuccess?: (data: ProvisioningSettingsResponseDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<
    ProvisioningSettingsResponseDto,
    UpdateProvisioningSettingsArgs
  >(
    ({ expectedVersion, input }) =>
      client.patch<ProvisioningSettingsResponseDto>(
        tenantSettingsPaths.provisioning(),
        input,
        { headers: buildIfMatchHeaders(expectedVersion) }
      ),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(tenantSettingsQueryKeys.provisioning(), data);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.current(),
          }),
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.overview(),
          }),
          queryClient.invalidateQueries({
            queryKey: tenantSettingsQueryKeys.audit(),
          }),
        ]);
        await opts?.onSuccess?.(data);
      },
    }
  );
}
