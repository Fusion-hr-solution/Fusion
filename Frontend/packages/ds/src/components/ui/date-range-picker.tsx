"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import type { DateRange, Matcher } from "react-day-picker"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

/** A selected range in `YYYY-MM-DD` string space — the shape the API and native date inputs use. */
export interface DateRangeValue {
  from?: string
  to?: string
}

/**
 * A date-range picker composed from the DS Popover + Calendar primitives — the range sibling of
 * {@link DatePicker}. Works in `YYYY-MM-DD` string space so it drops in wherever the API already
 * speaks dates, without touching serialization, and parses/formats in local time so the day the
 * user picks is the day that is stored.
 */
function DateRangePicker({
  value,
  onChange,
  min,
  max,
  id,
  placeholder = "Pick a date range",
  disabled,
  className,
  numberOfMonths = 2,
}: {
  value?: DateRangeValue
  onChange: (value: DateRangeValue) => void
  /** Inclusive lower bound as `YYYY-MM-DD`. */
  min?: string
  /** Inclusive upper bound as `YYYY-MM-DD`. */
  max?: string
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  numberOfMonths?: number
}) {
  const [open, setOpen] = React.useState(false)
  // When the popup opens onto an already-complete range, the first day-click should start a fresh
  // range from that day rather than nudge an endpoint of the old one — the intuitive way to re-pick.
  const restartOnNextClick = React.useRef(false)

  const from = parseISODate(value?.from)
  const to = parseISODate(value?.to)
  const minDate = parseISODate(min)
  const maxDate = parseISODate(max)

  const selected: DateRange | undefined = from ? { from, to } : undefined

  const disabledMatchers: Matcher[] = []
  if (minDate) disabledMatchers.push({ before: minDate })
  if (maxDate) disabledMatchers.push({ after: maxDate })

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) restartOnNextClick.current = Boolean(from && to)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!from}
          className={cn(
            "justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {from ? formatRange(from, to) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          autoFocus
          numberOfMonths={numberOfMonths}
          selected={selected}
          defaultMonth={from ?? minDate ?? undefined}
          startMonth={minDate ?? undefined}
          endMonth={maxDate ?? undefined}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          onSelect={(range: DateRange | undefined, day: Date) => {
            // A fresh click on a complete range restarts it from the clicked day.
            if (restartOnNextClick.current && day) {
              restartOnNextClick.current = false
              onChange({ from: formatISODate(day), to: undefined })
              return
            }
            restartOnNextClick.current = false
            const next: DateRangeValue = {
              from: range?.from ? formatISODate(range.from) : undefined,
              to: range?.to ? formatISODate(range.to) : undefined,
            }
            onChange(next)
            if (next.from && next.to) setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Parse `YYYY-MM-DD` into a local-time Date (midnight), or undefined. */
function parseISODate(value?: string): Date | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return undefined
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Format a Date to `YYYY-MM-DD` in local time. */
function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatOne(date: Date, withYear = true): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  })
}

/** "Aug 1 – Sep 30, 2026" when the years match, "Aug 1, 2026 – Sep 30, 2027" otherwise. */
function formatRange(from: Date, to?: Date): string {
  if (!to) return formatOne(from)
  const sameYear = from.getFullYear() === to.getFullYear()
  return `${formatOne(from, !sameYear)} – ${formatOne(to)}`
}

export { DateRangePicker }
