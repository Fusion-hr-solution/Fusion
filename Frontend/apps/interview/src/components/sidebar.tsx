"use client";

import { useState, useRef, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  LayoutGrid,
  ChevronsUpDown,
  BrainCircuit,
  BookOpen,
  BarChart2,
  Users,
  Handshake,
  Video,
  ClipboardList,
  Bell,
  Search,
  LogOut,
  User,
  Settings,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Section definitions ────────────────────────────────────────────────────

const SECTIONS = [
  { label: "Core",        href: "/core",        icon: BrainCircuit },
  { label: "Learning",    href: "/learning",    icon: BookOpen     },
  { label: "Performance", href: "/performance", icon: BarChart2    },
  { label: "Recruitment", href: "/recruitment", icon: Users        },
  { label: "Onboarding",  href: "/onboarding",  icon: Handshake    },
  { label: "Interview",   href: "/interview",   icon: Video        },
] as const;

type SectionLabel = (typeof SECTIONS)[number]["label"];

// ─── Sidebar nav items (left-hand navigation within this app) ───────────────

const NAV_ITEMS = [
  { label: "Tests",      icon: ClipboardList },
  { label: "Candidates", icon: Users         },
  { label: "Reports",    icon: BarChart2     },
  { label: "Settings",   icon: Settings      },
] as const;

// ─── App Location Switcher ───────────────────────────────────────────────────

function AppSwitcher() {
  const [open, setOpen]               = useState(false);
  const [active, setActive]           = useState<SectionLabel>("Interview");
  const [search, setSearch]           = useState("");
  const inputRef                      = useRef<HTMLInputElement>(null);

  // Focus the search input whenever the popover opens
  useEffect(() => {
    if (open) {
      // Small delay so Radix has time to mount the portal
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    } else {
      setSearch("");
    }
  }, [open]);

  const filtered = SECTIONS.filter((s) =>
    s.label.toLowerCase().includes(search.toLowerCase())
  );

  const ActiveIcon = SECTIONS.find((s) => s.label === active)?.icon ?? Video;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* ── Trigger button ── */}
      <Popover.Trigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-zinc-200 px-3 py-2",
            "text-[13px] font-medium text-zinc-700 bg-white",
            "hover:bg-zinc-50 transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
            open && "bg-zinc-50 border-zinc-300"
          )}
        >
          <LayoutGrid className="h-4 w-4 text-zinc-500 shrink-0" />
          {/* Label with a smooth cross-fade when it changes */}
          <span className="flex flex-1 items-center gap-1.5 min-w-0">
            <ActiveIcon className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="truncate">{active}</span>
          </span>
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-150",
              open && "text-zinc-600"
            )}
          />
        </button>
      </Popover.Trigger>

      {/* ── Popover content ── */}
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="bottom"
          sideOffset={6}
          // Match the sidebar width (256px = w-64) minus 2×12px padding = 232px,
          // but we use a CSS variable injected by Radix for the trigger width.
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className={cn(
            "z-50 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2"
          )}
        >
          {/* Search input */}
          <div className="flex items-center border-b border-zinc-100 px-3">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0 mr-2" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections…"
              className={cn(
                "flex-1 py-2.5 text-[13px] bg-transparent placeholder:text-zinc-400",
                "focus:outline-none"
              )}
            />
          </div>

          {/* List */}
          <div className="p-1">
            {/* Group label */}
            <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Navigate to
            </p>

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[13px] text-zinc-400">
                No sections found
              </p>
            ) : (
              filtered.map((section) => {
                const Icon     = section.icon;
                const isActive = section.label === active;

                return (
                  <button
                    key={section.label}
                    onClick={() => {
                      setActive(section.label);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px]",
                      "transition-colors duration-150",
                      isActive
                        ? "bg-zinc-100 font-medium text-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                    )}
                  >
                    <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                    <span className="flex-1 text-left">{section.label}</span>

                    {/* Active indicator */}
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-zinc-900 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

interface SidebarProps {
  onSearchOpen?: () => void;
}

export function Sidebar({ onSearchOpen }: SidebarProps) {
  const [activeNav,      setActiveNav]      = useState("Tests");
  const [accountOpen,    setAccountOpen]    = useState(false);
  const [notificationCount]                 = useState(3);
  const accountRef                          = useRef<HTMLDivElement>(null);

  // Close account menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-zinc-200 bg-white">

      {/* ── Logo ── */}
      <div className="flex h-16 shrink-0 items-center border-b border-zinc-200 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-zinc-900">Fusion HR</span>
        </div>
      </div>

      {/* ── App switcher ── */}
      <div className="shrink-0 px-3 pt-3 pb-1">
        <AppSwitcher />
        <div className="mt-3 border-t border-zinc-100" />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon     = item.icon;
          const isActive = activeNav === item.label;
          return (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px]",
                "transition-colors duration-150",
                isActive
                  ? "bg-zinc-100 font-medium text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}

        <div className="my-2 border-t border-zinc-100" />

        {/* Notifications */}
        <button className="relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors duration-150">
          <Bell className="h-4 w-4 shrink-0" />
          Notifications
          {notificationCount > 0 && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-medium text-white">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Search */}
        <button
          onClick={onSearchOpen}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors duration-150"
        >
          <Search className="h-4 w-4 shrink-0" />
          Search
          <span className="ml-auto rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-400">
            ⌘K
          </span>
        </button>
      </nav>

      {/* ── Account ── */}
      <div ref={accountRef} className="relative mt-auto shrink-0 border-t border-zinc-200 p-3">
        <button
          onClick={() => setAccountOpen((p) => !p)}
          className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-zinc-50 transition-colors duration-150 cursor-pointer"
        >
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
            RN
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-medium text-zinc-900 truncate">Raed Nas</p>
            <p className="text-[12px] text-zinc-500 truncate">Admin</p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-150",
              accountOpen && "rotate-180"
            )}
          />
        </button>

        {/* Account dropdown — opens upward */}
        {accountOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md">
            <button className="flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-zinc-700 hover:bg-zinc-50 transition-colors duration-150">
              <User className="h-4 w-4" />
              Profile
            </button>
            <button className="flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-zinc-700 hover:bg-zinc-50 transition-colors duration-150">
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <div className="border-t border-zinc-100" />
            <button className="flex w-full items-center gap-3 px-3 py-2.5 text-[13px] text-red-600 hover:bg-zinc-50 transition-colors duration-150">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}