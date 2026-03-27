"use client";

import { useState, useRef, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  LayoutGrid,
  ChevronsUpDown,
  Search,
  Check,
  BrainCircuit,
  BookOpen,
  BarChart2,
  Users,
  Handshake,
  Video,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { SidebarModule } from "./types";

const DEFAULT_MODULES: SidebarModule[] = [
  { label: "Core", href: "/core", icon: BrainCircuit },
  { label: "Learning", href: "/learning", icon: BookOpen },
  { label: "Performance", href: "/performance", icon: BarChart2 },
  { label: "Recruitment", href: "/recruitment", icon: Users },
  { label: "Onboarding", href: "/onboarding", icon: Handshake },
  { label: "Interview", href: "/interview", icon: Video },
];

interface ModuleSwitcherProps {
  activeModule: string;
  modules?: SidebarModule[];
  collapsed?: boolean;
}

export function ModuleSwitcher({
  activeModule,
  modules = DEFAULT_MODULES,
  collapsed = false,
}: ModuleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
    setSearch("");
  }, [open]);

  const filtered = modules.filter((m) =>
    m.label.toLowerCase().includes(search.toLowerCase())
  );

  const ActiveIcon =
    modules.find((m) => m.label === activeModule)?.icon ?? LayoutGrid;

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 py-1">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--ey-grey-100))]"
          title={activeModule}
        >
          <ActiveIcon className="h-4 w-4 text-[hsl(var(--ey-grey-400))]" />
        </div>
      </div>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-[hsl(var(--ey-grey-200))] px-3 py-2",
            "text-sm font-medium text-[hsl(var(--ey-grey-500))] bg-white",
            "hover:bg-[hsl(var(--ey-grey-100))] transition-colors duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ey-yellow))] focus-visible:ring-offset-2",
            open && "bg-[hsl(var(--ey-grey-100))] border-[hsl(var(--ey-grey-300))]"
          )}
        >
          <LayoutGrid className="h-4 w-4 text-[hsl(var(--ey-grey-400))] shrink-0" />
          <span className="flex flex-1 items-center gap-1.5 min-w-0">
            <ActiveIcon className="h-4 w-4 text-[hsl(var(--ey-grey-300))] shrink-0" />
            <span className="truncate">{activeModule}</span>
          </span>
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 text-[hsl(var(--ey-grey-300))] shrink-0 transition-transform duration-200",
              open && "text-[hsl(var(--ey-grey-500))]"
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          side="bottom"
          sideOffset={6}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className={cn(
            "z-50 overflow-hidden rounded-lg border border-[hsl(var(--ey-grey-200))] bg-white shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2"
          )}
        >
          {/* Search */}
          <div className="flex items-center border-b border-[hsl(var(--ey-grey-200))]/60 px-3">
            <Search className="h-3.5 w-3.5 text-[hsl(var(--ey-grey-300))] shrink-0 mr-2" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules…"
              className="flex-1 py-2.5 text-sm bg-transparent placeholder:text-[hsl(var(--ey-grey-300))] focus:outline-none"
            />
          </div>

          {/* Module list */}
          <div className="p-1">
            <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[hsl(var(--ey-grey-300))]">
              Navigate to
            </p>

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[hsl(var(--ey-grey-300))]">
                No modules found
              </p>
            ) : (
              filtered.map((mod) => {
                const Icon = mod.icon;
                const isActive = mod.label === activeModule;

                return (
                  <a
                    key={mod.label}
                    href={mod.href}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm",
                      "transition-colors duration-200",
                      isActive
                        ? "bg-[hsl(var(--ey-grey-500))] text-white font-medium"
                        : "text-[hsl(var(--ey-grey-500))] hover:bg-[hsl(var(--ey-grey-100))]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive
                          ? "text-[hsl(var(--ey-yellow))]"
                          : "text-[hsl(var(--ey-grey-400))]"
                      )}
                    />
                    <span className="flex-1 text-left">{mod.label}</span>
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-[hsl(var(--ey-yellow))] shrink-0" />
                    )}
                  </a>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
