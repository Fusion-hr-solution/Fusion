"use client";

import { useEffect, useState } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { SEARCH_DEBOUNCE_MS } from "@repo/ui";
import type { AccessProfileSummaryDto } from "@repo/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TableFilterToolbar } from "@/components/table-filter-toolbar";

const ACCESS_FILTER_OPTIONS = [
  { value: "all", label: "All access states" },
  { value: "NotInvited", label: "Not invited" },
  { value: "InvitePending", label: "Invite pending" },
  { value: "ActiveAccount", label: "Active account" },
  { value: "NeedsReview", label: "Needs review" },
] as const;

const EMPLOYEE_STATUS_OPTIONS = [
  { value: "all", label: "All employee statuses" },
  { value: "Active", label: "Active employees" },
  { value: "Inactive", label: "Inactive employees" },
] as const;

type AccessFilterValue = (typeof ACCESS_FILTER_OPTIONS)[number]["value"];
type EmployeeStatusFilterValue = (typeof EMPLOYEE_STATUS_OPTIONS)[number]["value"];

interface AccessToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  accessFilter: AccessFilterValue;
  onAccessFilterChange: (value: AccessFilterValue) => void;
  profileId: string | null;
  onProfileIdChange: (value: string | null) => void;
  employeeStatusFilter: EmployeeStatusFilterValue;
  onEmployeeStatusFilterChange: (value: EmployeeStatusFilterValue) => void;
  accessProfiles: AccessProfileSummaryDto[];
  isProfilesLoading: boolean;
  onClearFilters: () => void;
}

export function AccessToolbar({
  search,
  onSearchChange,
  accessFilter,
  onAccessFilterChange,
  profileId,
  onProfileIdChange,
  employeeStatusFilter,
  onEmployeeStatusFilterChange,
  accessProfiles,
  isProfilesLoading,
  onClearFilters,
}: AccessToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const hasFilters =
    localSearch.trim().length > 0 ||
    accessFilter !== "all" ||
    !!profileId ||
    employeeStatusFilter !== "all";

  const selectedAccessOption = ACCESS_FILTER_OPTIONS.find(
    (option) => option.value === accessFilter
  );
  const selectedEmployeeOption = EMPLOYEE_STATUS_OPTIONS.find(
    (option) => option.value === employeeStatusFilter
  );
  const selectedProfile = profileId
    ? accessProfiles.find((profile) => profile.id === profileId)
    : null;

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, search]);

  return (
    <TableFilterToolbar
      search={
        <div className="relative min-w-[16rem] max-w-md flex-[1_1_18rem]">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(event) => setLocalSearch(event.target.value)}
            placeholder="Search by name or email"
            className="pl-8"
          />
        </div>
      }
      primaryFilters={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={accessFilter !== "all" ? "secondary" : "outline"}
                size="sm"
                className="gap-1"
              >
                <ListFilter className="size-3.5" />
                {selectedAccessOption
                  ? selectedAccessOption.label
                  : "Access state"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter access state</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={accessFilter}
                onValueChange={(value) =>
                  onAccessFilterChange(value as AccessFilterValue)
                }
              >
                {ACCESS_FILTER_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={profileId ? "secondary" : "outline"}
                size="sm"
                className="gap-1"
                disabled={isProfilesLoading}
              >
                <ListFilter className="size-3.5" />
                {selectedProfile ? selectedProfile.name : "Access profile"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter access profile</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={profileId ?? "all"}
                onValueChange={(value) =>
                  onProfileIdChange(value === "all" ? null : value)
                }
              >
                <DropdownMenuRadioItem value="all">
                  All access profiles
                </DropdownMenuRadioItem>
                {accessProfiles.map((profile) => (
                  <DropdownMenuRadioItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={
                  employeeStatusFilter !== "all" ? "secondary" : "outline"
                }
                size="sm"
                className="gap-1"
              >
                <ListFilter className="size-3.5" />
                {selectedEmployeeOption
                  ? selectedEmployeeOption.label
                  : "Employee status"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter employee status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={employeeStatusFilter}
                onValueChange={(value) =>
                  onEmployeeStatusFilterChange(
                    value as EmployeeStatusFilterValue
                  )
                }
              >
                {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      clearAction={
        hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalSearch("");
              onClearFilters();
            }}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        ) : null
      }
    />
  );
}
