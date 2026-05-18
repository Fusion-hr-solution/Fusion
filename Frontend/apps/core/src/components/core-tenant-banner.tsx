"use client";

import { useRouter } from "next/navigation";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, SwitchCamera } from "lucide-react";

export function CoreTenantBanner() {
  const { tenantId, tenantName, tenantStatus, isLoading, isReady, clearTenant } = useTenantContext();
  const router = useRouter();

  if (!tenantId) return null;

  function handleExit() {
    clearTenant();
    router.push("/");
  }

  return (
    <div className="flex h-9 items-center gap-3 border-b bg-amber-50 px-4 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800/30">
      <div className="flex items-center gap-1.5 font-medium">
        <SwitchCamera className="size-3.5" />
        <span>Viewing</span>
        <span className="font-semibold">{tenantName ?? tenantId}</span>
        {tenantStatus ? (
          <Badge
            variant="outline"
            className="ml-1 h-4 px-1.5 text-[10px] font-normal uppercase tracking-wider border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
          >
            {tenantStatus}
          </Badge>
        ) : isLoading || !isReady ? (
          <Badge
            variant="outline"
            className="ml-1 h-4 px-1.5 text-[10px] font-normal uppercase tracking-wider border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
          >
            Loading
          </Badge>
        ) : null}
      </div>

      <span className="text-amber-600 dark:text-amber-400">·</span>

      <span className="text-amber-700 dark:text-amber-300">PlatformAdmin</span>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleExit}
          className="h-6 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-900/40"
          title="Exit tenant context"
        >
          <LogOut className="size-3" />
        </Button>
      </div>
    </div>
  );
}
