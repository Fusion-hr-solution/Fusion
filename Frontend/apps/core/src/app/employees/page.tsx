"use client";

import { useEffect, useState, useMemo } from "react";
import { getEmployees, getDepartments } from "@/services/employee-service";
import { DataTable, columns } from "@/components/employees";
import type { EmployeeListItem } from "@/types/employee";
import { Skeleton } from "@repo/ui";
import { Users } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const [employeesData, depts] = await Promise.all([
          getEmployees({ pageSize: 100 }),
          getDepartments(),
        ]);

        if (!cancelled) {
          setEmployees(employeesData.items);
          setDepartments(depts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load employees"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterableColumns = useMemo(
    () => [
      {
        id: "department",
        title: "Department",
        options: departments.map((dept) => ({ label: dept, value: dept })),
      },
      {
        id: "status",
        title: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
    [departments]
  );

  if (error) {
    return (
      <div className="container mx-auto px-6 py-10">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-xl font-semibold mb-2">Failed to load employees</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your organization&apos;s employee directory
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-24 ml-auto" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-md" />
          <div className="flex justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 border rounded-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-[15px] font-medium">No employees found</p>
          <p className="text-[13px] text-muted-foreground">
            Add employees to get started
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          searchPlaceholder="Search employees..."
          filterableColumns={filterableColumns}
        />
      )}
    </div>
  );
}
