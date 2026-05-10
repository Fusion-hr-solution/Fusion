"use client";

import { useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import { useQueryClient } from "@tanstack/react-query";
import { employeeRosterQueryKeys } from "../employees/employee-query-keys";
import { orgChartQueryKeys } from "./org-chart-query-keys";

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

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
      client.put(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}`,
        { managerId: newManagerId ?? EMPTY_GUID },
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
          queryKey: employeeRosterQueryKeys.profile(args.employeeId),
          exact: true,
        },
      ],
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orgChartQueryKeys.all(),
        });
      },
    }
  );
}
