"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Building2,
  MoreHorizontal,
  PencilLine,
  ShieldCheck,
  UserCircle2,
  UserRoundCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import type { EmployeeRosterItem } from "./employee-roster.types";

interface EmployeeRowActionsProps {
  employee: EmployeeRosterItem;
  tenantId: string | null;
  tenantSlug: string | null;
  canViewEmployee: boolean;
  canManageEmployee: boolean;
  canUseAccessWorkspace: boolean;
  canUseOrgChart: boolean;
}

export function EmployeeRowActions({
  employee,
  tenantId,
  tenantSlug,
  canViewEmployee,
  canManageEmployee,
  canUseAccessWorkspace,
  canUseOrgChart,
}: EmployeeRowActionsProps) {
  const hrefs = useMemo(
    () => ({
      profile: buildTenantContextHref(`/employees/${employee.stableEmployeeKey}`, tenantId, tenantSlug),
      edit: buildTenantContextHref(
        `/employees/${employee.stableEmployeeKey}?sheet=identity`,
        tenantId,
        tenantSlug
      ),
      orgChart: buildTenantContextHref(
        `/org-chart?focusEmployeeKey=${employee.stableEmployeeKey}`,
        tenantId,
        tenantSlug
      ),
      access: buildTenantContextHref("/access", tenantId, tenantSlug),
    }),
    [employee.stableEmployeeKey, tenantId, tenantSlug]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Open actions for ${employee.firstName} ${employee.lastName}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        {canViewEmployee ? (
          <DropdownMenuItem asChild>
            <Link href={hrefs.profile} onClick={(event) => event.stopPropagation()}>
              <UserCircle2 className="size-4" />
              View profile
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canManageEmployee ? (
          <DropdownMenuItem asChild>
            <Link href={hrefs.edit} onClick={(event) => event.stopPropagation()}>
              <PencilLine className="size-4" />
              Edit record
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canUseOrgChart ? (
          <DropdownMenuItem asChild>
            <Link href={hrefs.orgChart} onClick={(event) => event.stopPropagation()}>
              <Building2 className="size-4" />
              Focus in org chart
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canUseAccessWorkspace ? (
          <DropdownMenuItem asChild>
            <Link href={hrefs.access} onClick={(event) => event.stopPropagation()}>
              <ShieldCheck className="size-4" />
              Manage access
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canManageEmployee ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={hrefs.profile} onClick={(event) => event.stopPropagation()}>
                <UserRoundCog className="size-4" />
                {employee.status === "Inactive" ? "Reactivate employee" : "Deactivate employee"}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}