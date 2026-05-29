"use client";

import { createContext, useContext, type ReactNode } from "react";

export type EmployeeProfileRouteKind = "employee" | "self";

interface EmployeeProfileRouteContextValue {
  employeeId: string | null;
  route: EmployeeProfileRouteKind;
}

const EmployeeProfileRouteContext =
  createContext<EmployeeProfileRouteContextValue | null>(null);

export function EmployeeProfileRouteProvider({
  value,
  children,
}: {
  value: EmployeeProfileRouteContextValue;
  children: ReactNode;
}) {
  return (
    <EmployeeProfileRouteContext.Provider value={value}>
      {children}
    </EmployeeProfileRouteContext.Provider>
  );
}

export function useEmployeeProfileRouteContext() {
  return useContext(EmployeeProfileRouteContext);
}
