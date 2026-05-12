"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Minimum selectable date */
  minDate?: Date;
}

function TimeSpinner({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  label: string;
}) {
  function increment() {
    onChange(value >= max ? 0 : value + 1);
  }
  function decrement() {
    onChange(value <= 0 ? max : value - 1);
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={increment}
          className="flex h-6 w-10 items-center justify-center rounded-t-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={String(value).padStart(2, "0")}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 0 && n <= max) onChange(n);
          }}
          className="h-9 w-10 rounded-md border border-input bg-background text-center text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={decrement}
          className="flex h-6 w-10 items-center justify-center rounded-b-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  disabled,
  className,
  minDate,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const hours = value ? value.getHours() : 0;
  const minutes = value ? value.getMinutes() : 0;

  function handleDateSelect(day: Date | undefined) {
    if (!day) return;
    const next = new Date(day);
    if (value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    } else {
      next.setHours(9, 0, 0, 0);
    }
    onChange(next);
  }

  function handleHoursChange(h: number) {
    const next = value ? new Date(value) : new Date();
    next.setHours(h);
    if (!value) next.setMinutes(0, 0, 0);
    onChange(next);
  }

  function handleMinutesChange(m: number) {
    const next = value ? new Date(value) : new Date();
    next.setMinutes(m);
    if (!value) next.setHours(9, 0, 0);
    onChange(next);
  }

  function handleNow() {
    const now = new Date();
    now.setSeconds(0, 0);
    onChange(now);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? (
            <span className="truncate">
              {format(value, "MMM d, yyyy")}
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="font-semibold tabular-nums">
                {format(value, "HH:mm")}
              </span>
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 pb-2">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            disabled={minDate ? (date) => date < minDate : undefined}
            defaultMonth={value}
          />
        </div>

        {/* Time section */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Time
            </div>
            <button
              type="button"
              onClick={handleNow}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Now
            </button>
          </div>

          <div className="mt-2 flex items-center justify-center gap-1">
            <TimeSpinner
              value={hours}
              onChange={handleHoursChange}
              max={23}
              label="Hr"
            />
            <span className="mt-4 text-lg font-bold text-muted-foreground">:</span>
            <TimeSpinner
              value={minutes}
              onChange={handleMinutesChange}
              max={59}
              label="Min"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

DateTimePicker.displayName = "DateTimePicker";

export { DateTimePicker, type DateTimePickerProps };
