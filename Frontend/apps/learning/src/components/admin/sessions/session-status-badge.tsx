import { Badge } from "@repo/ui";
import { SESSION_STATUS_CONFIG } from "@/data/session-status-config";
import type { SessionStatus } from "@/types/admin";

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const cfg = SESSION_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={`gap-1 ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
