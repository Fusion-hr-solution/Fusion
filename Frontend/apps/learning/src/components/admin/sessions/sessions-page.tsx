"use client";

import { useCallback, useState } from "react";
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

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">In-Person Sessions</h1>
        <p className="text-sm text-muted-foreground">
          All sessions across all in-person trainings. Filter by date, status, or search.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filterSearch">Search</Label>
            <Input id="filterSearch" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Training, room, trainer..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filterFrom">From</Label>
            <Input id="filterFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filterTo">To</Label>
            <Input id="filterTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
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
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      ) : (
        <SessionListTable sessions={data?.items ?? []} />
      )}
    </div>
  );
}
