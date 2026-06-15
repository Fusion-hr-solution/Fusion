import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownSelectProps {
  id: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  emptyMessage?: string;
}

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  dropUp: boolean;
}

const GAP = 6;
const MAX_MENU_HEIGHT = 256;

export function DropdownSelect({
  id,
  label,
  ariaLabel,
  placeholder = "Select",
  value,
  options,
  onChange,
  disabled,
  className,
  buttonClassName,
  menuClassName,
  emptyMessage = "No options available",
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  // Compute fixed-position coordinates from the trigger. The menu is portaled to
  // <body>, so it escapes any clipping/overflow ancestor (e.g. a scrollable modal)
  // and flips upward whenever it wouldn't fit below the trigger.
  function computePosition(): void {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const desired = Math.min(MAX_MENU_HEIGHT, options.length * 40 + 8);
    const dropUp = spaceBelow < desired && spaceAbove > spaceBelow;
    const maxHeight = Math.max(96, Math.min(MAX_MENU_HEIGHT, dropUp ? spaceAbove : spaceBelow));

    setPos({
      left: rect.left,
      width: rect.width,
      top: dropUp ? undefined : rect.bottom + GAP,
      bottom: dropUp ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight,
      dropUp,
    });
  }

  // Position before paint when opening, then keep it pinned to the trigger while
  // open as the page/modal scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    const onScrollOrResize = () => computePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length]);

  // Close on outside click (the menu lives in a portal, so check it explicitly)
  // and on Escape.
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent): void {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-labelledby={id}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
              zIndex: 9999,
            }}
            className={cn(
              "overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg",
              menuClassName
            )}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-zinc-400">{emptyMessage}</div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition-colors",
                    option.value === value
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  )}
                  role="option"
                  aria-selected={option.value === value}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value ? (
                    <span className="text-[11px] font-semibold opacity-80">Selected</span>
                  ) : null}
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-zinc-600">
          {label}
        </label>
      ) : null}
      <button
        id={id}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 shadow-sm transition-colors",
          "hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          buttonClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={cn("truncate", selectedLabel ? "text-zinc-900" : "text-zinc-400")}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform", open ? "rotate-180" : "rotate-0")} />
      </button>

      {menu}
    </div>
  );
}
