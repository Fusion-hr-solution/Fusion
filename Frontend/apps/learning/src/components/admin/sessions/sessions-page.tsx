"use client";

import { useCallback, useState } from "react";
import { CalendarClock, Search, Filter, X } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
} from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getSessions } from "@/services/admin-sessions-service";
import { SESSION_STATUS_OPTIONS } from "@/data/session-status-config";
import type { SessionStatus, SessionsListFilters } from "@/types/admin";
import { SessionListTable } from "./session-list-table";

const ANY = "__any__";

export function SessionsPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<string>(ANY);

  const hasFilters = search || from || to || status !== ANY;

  const filters: SessionsListFilters = {
    search: search || undefined,
    fromUtc: from ? new Date(from).toISOString() : undefined,
    toUtc: to ? new Date(to).toISOString() : undefined,
    status: status !== ANY ? (status as SessionStatus) : undefined,
    page: 1,
    pageSize: 50,
  };

  const fetcher = useCallback(() => getSessions(filters), [search, from, to, status]);
  const { data, isLoading } = useApiQuery(fetcher);

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setStatus(ANY);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--ey-black))] text-white">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">In-Person Sessions</h1>
            <p className="text-sm text-muted-foreground">
              All scheduled sessions across trainings
              {data && ` · ${data.totalCount} total`}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filters</span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="filterSearch" className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="filterSearch"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Training, room, trainer..."
                  className="h-9 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterFrom" className="text-xs">From</Label>
              <Input
                id="filterFrom"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterTo" className="text-xs">To</Label>
              <Input
                id="filterTo"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterStatus" className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="filterStatus" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any status</SelectItem>
                  {SESSION_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border/40 bg-muted/30" />
          ))}
        </div>
      ) : (
        <SessionListTable sessions={data?.items ?? []} />
      )}
    </div>
  );
}
