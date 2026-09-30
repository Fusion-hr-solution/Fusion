"use client";

import { useRef, useState } from "react";
import type { RowData } from "@tanstack/react-table";
import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Plus, Search, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "../components/ui/button";
import { Calendar } from "../components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  isFilterActive,
  type DataTableDateRange,
  type DataTableFilterField,
  type DataTableFilterOption,
  type DataTableFilterState,
  type DataTableFilterValue,
  type DataTableModel,
} from "./use-data-table";

/*
 * The filter bar: the one way a Fusion table narrows its rows. Every filter is a chip that reads as a
 * sentence — "Module is any of Performance, Learning" — and edits in place through the DS dropdown
 * (option fields) or the DS calendar popover (date fields). Pinned fields are the table's primary
 * question: their chip is always shown and resets to "All". Other fields are added through "Filter".
 * The fields, their state and their counts all come from the model (`useDataTable({ filters })`).
 */

type Field = DataTableFilterField<unknown>;

/** Lists longer than this get a search field. */
const SEARCH_THRESHOLD = 7;

export function DataTableFilters<TData extends RowData>({
  model,
}: {
  model: DataTableModel<TData>;
}) {
  const { fields: typedFields, state, set, counts } = model.filters;
  const fields = typedFields as Field[];
  if (fields.length === 0) return null;

  const pinned = fields.filter((f) => f.pinned);
  const addable = fields.filter((f) => !f.pinned);
  const active = addable.filter((f) => isFilterActive(state[f.id]));
  const anyActive = fields.some((f) => isFilterActive(state[f.id]));

  return (
    <>
      {pinned.map((field) => (
        <FilterChip
          key={field.id}
          field={field}
          value={state[field.id]}
          counts={counts[field.id]}
          onChange={(next) => set({ [field.id]: next })}
        />
      ))}
      {active.map((field) => (
        <FilterChip
          key={field.id}
          field={field}
          value={state[field.id]}
          counts={counts[field.id]}
          onChange={(next) => set({ [field.id]: next })}
        />
      ))}
      {addable.length > 0 ? (
        <AddFilter
          fields={addable}
          state={state}
          compact={active.length > 0}
          countsFor={(field) => counts[field.id]}
          onCommit={set}
        />
      ) : null}
      {anyActive &&
      fields.filter((f) => isFilterActive(state[f.id])).length > 1 ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            set(Object.fromEntries(fields.map((f) => [f.id, undefined])))
          }
        >
          Clear
        </Button>
      ) : null}
    </>
  );
}

// ── Adding a filter: the DS menu, one submenu per field ─────────────────────────

function AddFilter({
  fields,
  state,
  compact,
  countsFor,
  onCommit,
}: {
  fields: Field[];
  state: DataTableFilterState;
  compact: boolean;
  countsFor: (field: Field) => Record<string, number> | undefined;
  onCommit: (changes: DataTableFilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Choices are held here and become chips when the menu closes. Committing mid-choice would insert a
  // chip and move this trigger out from under its own open menu.
  const [drafts, setDrafts] = useState<DataTableFilterState>({});
  const [dateField, setDateField] = useState<Field | null>(null);
  const [dateDraft, setDateDraft] = useState<DataTableDateRange | undefined>(
    undefined
  );

  const closeDate = (final?: DataTableDateRange) => {
    const chosen = final ?? dateDraft;
    if (dateField && chosen) onCommit({ [dateField.id]: chosen });
    setDateField(null);
    setDateDraft(undefined);
  };

  const close = (final?: DataTableFilterState) => {
    const changes = { ...drafts, ...final };
    if (Object.keys(changes).length > 0) onCommit(changes);
    setDrafts({});
    setQuery("");
    setOpen(false);
  };

  const term = query.trim().toLowerCase();
  const visible = term
    ? fields.filter((f) => f.label.toLowerCase().includes(term))
    : fields;

  return (
    <Popover
      open={dateField !== null}
      onOpenChange={(next) => {
        if (!next) closeDate();
      }}
    >
      <PopoverAnchor asChild>
        <span className="inline-flex">
          <DropdownMenu
            open={open}
            onOpenChange={(next) => {
              if (next) setOpen(true);
              else close();
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size={compact ? "icon" : "default"}
                aria-label="Add filter"
              >
                {compact ? (
                  <Plus aria-hidden />
                ) : (
                  <HugeiconsIcon icon={FilterHorizontalIcon} aria-hidden />
                )}
                {compact ? null : "Filter"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {fields.length > SEARCH_THRESHOLD ? (
                <MenuSearch
                  value={query}
                  onChange={setQuery}
                  placeholder="Filter by…"
                />
              ) : null}
              {visible.map((field) => {
                const current = drafts[field.id] ?? state[field.id];
                if (field.type === "dateRange") {
                  return (
                    <DropdownMenuItem
                      key={field.id}
                      onSelect={() => {
                        setDateDraft(undefined);
                        setDateField(field);
                      }}
                    >
                      {field.icon ? (
                        <field.icon className="text-muted-foreground" />
                      ) : null}
                      {field.label}
                      {isFilterActive(current) ? (
                        <span
                          aria-label="Active"
                          className="ml-auto size-1.5 rounded-full bg-primary"
                        />
                      ) : null}
                    </DropdownMenuItem>
                  );
                }
                return (
                  <DropdownMenuSub key={field.id}>
                    <DropdownMenuSubTrigger>
                      {field.icon ? (
                        <field.icon className="text-muted-foreground" />
                      ) : null}
                      {field.label}
                      {isFilterActive(current) ? (
                        <span
                          aria-label="Active"
                          className="ml-auto size-1.5 rounded-full bg-primary"
                        />
                      ) : null}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <ValueMenu
                        field={field}
                        value={current}
                        counts={countsFor(field)}
                        onChange={(next) =>
                          setDrafts((d) => ({ ...d, [field.id]: next }))
                        }
                        onDone={(final) =>
                          close(
                            final === undefined
                              ? undefined
                              : { [field.id]: final }
                          )
                        }
                      />
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-auto p-1">
        {dateField ? (
          <DateRangeEditor
            value={
              dateDraft ??
              (state[dateField.id] as DataTableDateRange | undefined) ??
              {}
            }
            onChange={setDateDraft}
            onDone={(final) => closeDate(final as DataTableDateRange)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// ── An active filter, as a sentence ─────────────────────────────────────────────

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const DATE_FORMAT_SHORT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function parseDate(value?: string): Date | undefined {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : undefined;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function describe(
  field: Field,
  value: DataTableFilterValue | undefined
): { operator: string; text: string } {
  if (!isFilterActive(value)) return { operator: "is", text: "All" };
  if (field.type === "options") {
    const selected = value as string[];
    const labels = selected.map(
      (v) => field.options.find((o) => o.value === v)?.label ?? v
    );
    return {
      operator: selected.length === 1 ? "is" : "is any of",
      text:
        labels.length <= 2
          ? labels.join(", ")
          : `${labels[0]} +${labels.length - 1}`,
    };
  }
  const { from, to } = value as DataTableDateRange;
  const f = parseDate(from);
  const t = parseDate(to);
  if (f && t) {
    const sameYear = f.getFullYear() === t.getFullYear();
    return {
      operator: "between",
      text: `${(sameYear ? DATE_FORMAT_SHORT : DATE_FORMAT).format(f)} – ${DATE_FORMAT.format(t)}`,
    };
  }
  if (f) return { operator: "after", text: DATE_FORMAT.format(f) };
  return { operator: "before", text: t ? DATE_FORMAT.format(t) : "" };
}

function FilterChip({
  field,
  value,
  counts,
  onChange,
}: {
  field: Field;
  value: DataTableFilterValue | undefined;
  counts?: Record<string, number>;
  onChange: (next: DataTableFilterValue | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const { operator, text } = describe(field, value);
  const FieldIcon = field.icon;
  const valueButton = (
    <button
      type="button"
      aria-label={`${field.label} ${operator} ${text}. Edit`}
      className="min-w-0 truncate px-1.5 last:pr-2.5 font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted data-[state=open]:bg-muted"
    >
      {text}
    </button>
  );

  return (
    <div className="inline-flex h-8 max-w-full items-stretch overflow-hidden rounded-control border border-border bg-inlay text-sm">
      <span className="flex items-center gap-1.5 pl-2.5 pr-1.5 text-muted-foreground">
        {FieldIcon ? <FieldIcon className="size-3.5 text-primary" /> : null}
        {field.label}
        <span className="hidden text-muted-foreground/70 sm:inline">
          {operator}
        </span>
      </span>
      {/* The chip sits still while its value changes, so editing applies live. */}
      {field.type === "dateRange" ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{valueButton}</PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-1">
            <DateRangeEditor
              value={(value as DataTableDateRange | undefined) ?? {}}
              onChange={onChange}
              onDone={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{valueButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <ValueMenu
              field={field}
              value={value}
              counts={counts}
              onChange={onChange}
              onDone={() => setOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {field.pinned ? null : (
        <button
          type="button"
          aria-label={`Remove ${field.label} filter`}
          onClick={() => onChange(undefined)}
          className="flex w-7 items-center justify-center border-l border-border text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ── A field's values, as DS menu items ──────────────────────────────────────────

function ValueMenu({
  field,
  value,
  counts,
  onChange,
  onDone,
}: {
  field: Field;
  value: DataTableFilterValue | undefined;
  counts?: Record<string, number>;
  onChange: (next: DataTableFilterValue | undefined) => void;
  /** A choice is complete (a single option, a full range); `final` is that value. */
  onDone: (final?: DataTableFilterValue) => void;
}) {
  const [query, setQuery] = useState("");
  if (field.type !== "options") return null;

  const selected = (value as string[] | undefined) ?? [];
  const term = query.trim().toLowerCase();
  const options = term
    ? field.options.filter((o) => o.label.toLowerCase().includes(term))
    : field.options;
  // With counts, a row keeps no empty gutter: the count sits at the edge, and a checked row shows its
  // check mark there instead.
  const itemClass = counts
    ? "group/option pr-2.5 data-[state=checked]:pr-8"
    : undefined;
  const count = (option: DataTableFilterOption<unknown>) =>
    counts ? (
      <span className="ml-auto pl-3 text-xs tabular-nums text-muted-foreground group-data-[state=checked]/option:hidden">
        {counts[option.value] ?? 0}
      </span>
    ) : null;

  return (
    <>
      {field.options.length > SEARCH_THRESHOLD ? (
        <MenuSearch
          value={query}
          onChange={setQuery}
          placeholder={field.label}
        />
      ) : null}
      {field.single ? (
        <DropdownMenuRadioGroup
          value={selected[0] ?? ""}
          onValueChange={(next) => {
            const chosen = next ? [next] : [];
            onChange(chosen);
            onDone(chosen);
          }}
        >
          {field.pinned ? (
            <DropdownMenuRadioItem value="" className={itemClass}>
              All
            </DropdownMenuRadioItem>
          ) : null}
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className={itemClass}
            >
              {option.icon ? (
                <option.icon className="text-muted-foreground" />
              ) : null}
              {option.label}
              {count(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      ) : (
        options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              className={itemClass}
              checked={checked}
              // Several values are picked in one visit, so choosing one keeps the menu open.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() =>
                onChange(
                  checked
                    ? selected.filter((v) => v !== option.value)
                    : [...selected, option.value]
                )
              }
            >
              {option.icon ? (
                <option.icon className="text-muted-foreground" />
              ) : null}
              {option.label}
              {count(option)}
            </DropdownMenuCheckboxItem>
          );
        })
      )}
      {options.length === 0 ? (
        <p className="px-2.5 py-2 text-sm text-muted-foreground">No results</p>
      ) : null}
    </>
  );
}

/** A search field inside a menu. Keys stay in the field instead of driving the menu's type-to-find. */
function MenuSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <DropdownMenuSeparator />
    </>
  );
}

/**
 * Two clicks make a range: the first sets the start, the second the end, and the popover closes. Opened
 * onto an existing range, the first click starts a new one. (The picker itself reports a first click as
 * a one-day range, so the sequence is tracked here rather than read from the range.)
 */
function DateRangeEditor({
  value,
  onChange,
  onDone,
}: {
  value: DataTableDateRange;
  onChange: (next: DataTableDateRange) => void;
  onDone: (final?: DataTableFilterValue) => void;
}) {
  const clicks = useRef(0);
  const from = parseDate(value.from);
  const to = parseDate(value.to);
  const selected: DateRange | undefined = from ? { from, to } : undefined;

  return (
    <Calendar
      mode="range"
      numberOfMonths={1}
      selected={selected}
      defaultMonth={from}
      onSelect={(next: DateRange | undefined, day: Date) => {
        clicks.current += 1;
        if (clicks.current === 1) {
          onChange({ from: isoDate(day), to: undefined });
          return;
        }
        const range = {
          from: next?.from ? isoDate(next.from) : isoDate(day),
          to: next?.to ? isoDate(next.to) : undefined,
        };
        onChange(range);
        if (range.from && range.to) onDone(range);
      }}
    />
  );
}
