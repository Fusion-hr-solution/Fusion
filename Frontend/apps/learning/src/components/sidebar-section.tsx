import Link from "next/link";
import type { SidebarSectionProps } from "@/types/component-props";

export function SidebarSection({
  section,
  activePath,
  collapsed,
}: SidebarSectionProps) {
  return (
    <div>
      {!collapsed && (
        <p className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
          {section.title}
        </p>
      )}
      <ul className="space-y-0.5">
        {section.items.map((item) => {
          const isActive = activePath === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                  collapsed ? "justify-center px-2" : ""
                } ${
                  isActive
                    ? "ey-bg-dark text-white shadow-sm"
                    : "text-muted-foreground hover:bg-[hsl(var(--ey-grey-100))] hover:text-foreground"
                }`}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full ey-bg-accent" />
                )}
                <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-[hsl(var(--ey-yellow))]" : ""}`} aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold transition-colors ${
                          isActive
                            ? "ey-bg-accent text-[hsl(var(--ey-grey-500))]"
                            : "bg-[hsl(var(--ey-grey-200))] text-muted-foreground"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
