"use client";

import { ChevronDown, Clock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@repo/ui";
import { useTranslations } from "next-intl";
import type { SessionPickerPartProps } from "@/types/component-props";
import { SessionPickerCard } from "./session-picker-card";

export function SessionPickerPart({ part, selectedSessionId, onSelect }: SessionPickerPartProps) {
  const t = useTranslations("trainingDetail.sessions.picker");
  const [expanded, setExpanded] = useState(true);
  const totalSessions = part.sessions.length;
  const availableSessions = part.sessions.filter((s) => !s.isFull).length;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {part.orderIndex + 1}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{part.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{t("hours", { count: part.durationHours })}</span>
              <span className="text-border">·</span>
              <span>{t("sessionsCount", { count: totalSessions })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedSessionId ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
              {t("selected")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t("availableCount", { count: availableSessions })}
            </Badge>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-5 pb-4 pt-3">
          {part.description && (
            <p className="mb-3 text-xs text-muted-foreground">{part.description}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {part.sessions.map((session) => (
              <SessionPickerCard
                key={session.sessionId}
                session={session}
                isSelected={selectedSessionId === session.sessionId}
                onSelect={() => onSelect(session.sessionId)}
              />
            ))}
          </div>
          {totalSessions === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noSessions")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
