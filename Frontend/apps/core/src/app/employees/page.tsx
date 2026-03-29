"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getEmployees, getDepartments, ApiError } from "@/services/employee-service";
import { DataTable, columns } from "@/components/employees";
import { ErrorState, EmptyState } from "@/components/feedback";
import type { EmployeesPagedResult } from "@/types/employee";
import { Skeleton } from "@repo/ui";
import { Users } from "lucide-react";

export default function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from URL
  const filters = useMemo(() => ({
    search: searchParams.get("search") || undefined,
    department: searchParams.get("department") || undefined,
    status: (searchParams.get("status") as "active" | "inactive") || undefined,
    page: parseInt(searchParams.get("page") || "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") || "10", 10),
  }), [searchParams]);

  const [data, setData] = useState<EmployeesPagedResult | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data when filters change
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const [employeesData, depts] = await Promise.all([
          getEmployees(filters),
          getDepartments(),
        ]);

        if (!cancelled) {
          setData(employeesData);
          setDepartments(depts);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            if (err.status === 401) {
              setError("Please log in to view employees.");
            } else if (err.status === 400) {
              setError(err.errors[0] || "Invalid request. Please check your filters.");
            } else {
              setError(err.errors[0] || "Failed to load employees.");
            }
          } else {
            setError("Failed to load employees. Please try again.");
          }
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
  }, [filters]);

  // Update URL when filters change
  const handleFilterChange = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change (except page itself)
      if (key !== "page") {
        params.set("page", "1");
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      handleFilterChange("page", newPage.toString());
    },
    [handleFilterChange]
  );

  const handleRetry = useCallback(() => {
    window.location.reload();
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your organization&apos;s employee directory
          </p>
        </div>
        <div className="border rounded-md">
          <ErrorState
            title="Failed to load employees"
            message={error}
            onRetry={handleRetry}
          />
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
      ) : data && data.items.length === 0 ? (
        <div className="border rounded-md">
          <EmptyState
            icon={Users}
            title="No employees found"
            description={
              filters.search || filters.department || filters.status
                ? "Try adjusting your search or filters"
                : "Add employees to get started"
            }
            action={
              filters.search || filters.department || filters.status
                ? { label: "Clear filters", onClick: () => router.push("/employees") }
                : undefined
            }
          />
        </div>
      ) : data ? (
        <DataTable
          columns={columns}
          data={data.items}
          searchPlaceholder="Search employees..."
          filterableColumns={filterableColumns}
          pagination={{
            page: data.page,
            pageSize: data.pageSize,
            totalCount: data.totalCount,
            totalPages: data.totalPages,
            onPageChange: handlePageChange,
          }}
          onFilterChange={handleFilterChange}
          currentFilters={filters}
        />
      ) : null}
    </div>
  );
}
