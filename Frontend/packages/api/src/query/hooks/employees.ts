import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPlatformApiClient } from "../../platform";
import type { EmployeeListItemDto, EmployeeDto, PagedResponse } from "../../corehr-types";
import { queryKeys, type EmployeeListParams } from "../keys";

export function useEmployees(params?: EmployeeListParams) {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: async () => {
      const res = await client.get<PagedResponse<EmployeeListItemDto>>("/corehr/employees", {
        params: {
          status: params?.status,
          managerId: params?.managerId,
          orgUnitId: params?.orgUnitId,
        },
      });
      return res.items;
    },
  });
}

export function useEmployee(id: string) {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useQuery({
    queryKey: queryKeys.employees.detail(id),
    queryFn: () => client.get<EmployeeDto>(`/corehr/employees/${id}`),
    enabled: !!id,
  });
}
