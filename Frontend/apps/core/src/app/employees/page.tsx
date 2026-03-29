"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getEmployees, getDepartments, ApiError } from "@/services/employee-service";
import { DataTable, createColumns, columnToSortField } from "@/components/employees";
import type { EmployeesPagedResult, EmployeeSortField, SortDirection } from "@/types/employee";
import { Button, Skeleton, EmptyState, ErrorState, DEFAULT_PAGE_SIZE, DEFAULT_PAGE } from "@repo/ui";
import { Users, Plus, ChevronRight, Home } from "lucide-react";

export default function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from URL
  const filters = useMemo(() => ({
    search: searchParams.get("search") || undefined,
    department: searchParams.get("department") || undefined,
    status: (searchParams.get("status") as "active" | "inactive") || undefined,
    page: parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10),
    pageSize: parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10),
    sortBy: (searchParams.get("sortBy") as EmployeeSortField) || undefined,
    sortDir: (searchParams.get("sortDir") as SortDirection) || undefined,
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
      // Reset to page 1 when filters change (except page/pageSize itself)
      if (key !== "page" && key !== "pageSize") {
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

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", newPageSize.toString());
      params.set("page", "1"); // Reset to first page
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSortChange = useCallback(
    (columnId: string) => {
      const backendField = columnToSortField[columnId];
      if (!backendField) return;

      const params = new URLSearchParams(searchParams.toString());
      const currentSortBy = params.get("sortBy");
      const currentSortDir = params.get("sortDir");

      if (currentSortBy !== backendField) {
        // Different column -> start with Asc
        params.set("sortBy", backendField);
        params.set("sortDir", "Asc");
      } else if (currentSortDir === "Asc") {
        // Same column, was Asc -> go Desc
        params.set("sortDir", "Desc");
      } else {
        // Same column, was Desc -> clear sort
        params.delete("sortBy");
        params.delete("sortDir");
      }
      
      params.set("page", "1"); // Reset to first page on sort
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
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

  // Create columns with sort handlers
  const columns = useMemo(
    () => createColumns(handleSortChange, filters.sortBy, filters.sortDir),
    [handleSortChange, filters.sortBy, filters.sortDir]
  );

  // Page header component
  const PageHeader = () => (
    <div className="mb-8 space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="flex items-center hover:text-foreground transition-colors">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Employees</span>
      </nav>

      {/* Title + Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your organization&apos;s employee directory
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="container mx-auto px-6 py-10">
        <PageHeader />
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
      <PageHeader />

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
                ? { label: "Clear filters", onClick: () => router.push("/core/employees") }
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
            onPageSizeChange: handlePageSizeChange,
          }}
          onFilterChange={handleFilterChange}
          currentFilters={filters}
        />
      ) : null}
    </div>
  );
}
