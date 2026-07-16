"use client";

import { useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import { useQueryClient } from "@tanstack/react-query";
import { employeeRosterQueryKeys } from "../employees/employee-query-keys";
import { orgChartQueryKeys } from "./org-chart-query-keys";

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

function getImmediateEffectiveDateIso() {
  return new Date().toISOString();
}

export interface ReassignManagerInput {
  employeeId: string;
  newManagerId: string | null;
  expectedVersion: number;
}

export function useReassignManagerFromChart() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useQueryClient();

  return useApiMutation<unknown, ReassignManagerInput>(
    ({ employeeId, newManagerId, expectedVersion }) =>
      client.post(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/change-manager`,
        {
          managerId: newManagerId ?? EMPTY_GUID,
          effectiveDate: getImmediateEffectiveDateIso(),
        },
        { headers: { "If-Match": `"${expectedVersion}"` } }
      ),
    {
      invalidateQueries: (_data, args) => [
        { queryKey: employeeRosterQueryKeys.lists() },
        {
          queryKey: employeeRosterQueryKeys.reportingLines(args.employeeId),
          exact: true,
        },
        {
          queryKey: employeeRosterQueryKeys.detailsById(args.employeeId),
          exact: true,
        },
        ...(args.newManagerId
          ? [
              {
                queryKey: employeeRosterQueryKeys.reportingLines(args.newManagerId),
                exact: true,
              },
              {
                queryKey: employeeRosterQueryKeys.detailsById(args.newManagerId),
                exact: true,
              },
            ]
          : []),
      ],
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orgChartQueryKeys.all(),
        });
      },
    }
  );
}
