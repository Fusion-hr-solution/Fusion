import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MiniStatProps {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  className?: string;
}

export function MiniStat({ label, value, sub, icon: Icon, className }: MiniStatProps) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white p-3", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-[20px] font-bold leading-tight text-zinc-900">{value}</p>
      {sub ? <p className="text-[11px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}
