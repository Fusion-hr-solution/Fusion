"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
} from "@repo/ui";
import { rotateFeedToken } from "@/services/calendar-service";
import type { CalendarFeedSubscriptionDto } from "@/types/calendar";

interface SubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscribeDialog({ open, onOpenChange }: SubscribeDialogProps) {
  const t = useTranslations("calendar.subscribe");
  const [sub, setSub] = useState<CalendarFeedSubscriptionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    try {
      setSub(await rotateFeedToken());
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(t("copied"));
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error(t("copyError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {!sub ? (
          <Button onClick={generate} disabled={loading} className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            {loading ? t("generating") : t("generate")}
          </Button>
        ) : (
          <div className="space-y-4">
            <UrlRow
              label={t("webcal")}
              value={sub.webcalUrl}
              copied={copied === "webcal"}
              onCopy={() => copy(sub.webcalUrl, "webcal")}
            />
            <UrlRow
              label={t("https")}
              value={sub.feedUrl}
              copied={copied === "https"}
              onCopy={() => copy(sub.feedUrl, "https")}
            />
            <p className="text-xs text-muted-foreground">{t("instructions")}</p>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <p className="text-xs text-amber-600 dark:text-amber-400">{t("warning")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={generate}
                disabled={loading}
                className="shrink-0 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {t("regenerate")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UrlRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className="h-9 font-mono text-xs" />
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onCopy}>
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
