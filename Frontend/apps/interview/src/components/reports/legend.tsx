import { cn } from "@/lib/utils";

interface LegendItem {
  label: string;
  className: string;
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", item.className)} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
