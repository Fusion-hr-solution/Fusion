import { useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  useEffect(() => {
    function handleClick(event: MouseEvent): void {
      const target = event.target as Node | null;
      if (open && containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label ? (
        <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-zinc-600">
          {label}
        </label>
      ) : null}
      <button
        id={id}
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

      {open ? (
        <div
          className={cn(
            "absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg",
            menuClassName
          )}
          role="listbox"
          aria-labelledby={id}
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
        </div>
      ) : null}
    </div>
  );
}