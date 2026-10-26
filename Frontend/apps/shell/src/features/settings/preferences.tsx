"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { isLocale, type Locale } from "@repo/i18n/config";
import { useLanguage } from "@repo/auth";
import { cn, RadioGroup, RadioGroupItem, ToggleGroup, ToggleGroupItem } from "@repo/ds";
import { SettingsBlock, SettingsPage, SettingsRow, SettingsRows, SettingsSaved, useTheme } from "@repo/ds/shell";

type Appearance = "dark" | "light" | "system";

const APPEARANCES: { value: Appearance; icon: LucideIcon }[] = [
  { value: "dark", icon: Moon },
  { value: "light", icon: Sun },
  { value: "system", icon: Monitor },
];

/** Each language names itself, whatever the page's language. */
const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

/**
 * A small picture of Fusion in one appearance. It shows that appearance's own colours whatever the page's theme,
 * so its fills are fixed rather than theme tokens.
 */
function Miniature({ tone }: { tone: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex h-full min-w-0 flex-1", dark ? "bg-zinc-950" : "bg-zinc-50")}>
      <div className={cn("flex w-1/4 flex-col gap-1.5 p-2", dark ? "bg-zinc-900" : "bg-zinc-200")}>
        <span className="h-1.5 w-5 rounded-full bg-primary" />
        <span className={cn("h-1 w-full rounded-full", dark ? "bg-zinc-700" : "bg-zinc-300")} />
        <span className={cn("h-1 w-full rounded-full", dark ? "bg-zinc-700" : "bg-zinc-300")} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <span className={cn("h-2 w-1/2 rounded-full", dark ? "bg-zinc-200" : "bg-zinc-800")} />
        <span className={cn("h-1 w-5/6 rounded-full", dark ? "bg-zinc-700" : "bg-zinc-300")} />
        <span className={cn("h-1 w-2/3 rounded-full", dark ? "bg-zinc-700" : "bg-zinc-300")} />
      </div>
    </div>
  );
}

function AppearancePreview({ value }: { value: Appearance }) {
  return (
    <div aria-hidden className="flex h-28 overflow-hidden rounded-control border border-border">
      {value === "system" ? (
        <>
          <Miniature tone="dark" />
          <Miniature tone="light" />
        </>
      ) : (
        <Miniature tone={value} />
      )}
    </div>
  );
}

/**
 * Settings › Preferences, in the person's language: appearance, kept on this device, and language, kept on their
 * account. Both save the moment they change.
 */
export function Preferences() {
  const t = useTranslations("settings.preferences");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [language, setLanguage, savingLanguage] = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [languageFailed, setLanguageFailed] = useState(false);
  useEffect(() => setMounted(true), []);

  const appearance = mounted && (theme === "dark" || theme === "light" || theme === "system") ? theme : undefined;

  const chooseLanguage = async (next: Locale) => {
    setLanguageFailed(false);
    try {
      await setLanguage(next);
      setSavedAt(Date.now());
    } catch {
      setLanguageFailed(true);
    }
  };

  return (
    <div lang={locale} className="contents">
      <SettingsPage title={t("title")} aside={<SettingsSaved at={savedAt} />}>
        <SettingsBlock title={t("appearance")} meta={t("thisDevice")}>
          <RadioGroup
            aria-label={t("appearance")}
            value={appearance ?? ""}
            onValueChange={(next) => {
              setTheme(next);
              setSavedAt(Date.now());
            }}
            className="grid grid-cols-3 gap-3"
          >
            {APPEARANCES.map((option) => {
              const Icon = option.icon;
              const selected = appearance === option.value;
              return (
                <label
                  key={option.value}
                  htmlFor={`appearance-${option.value}`}
                  className={cn(
                    "flex cursor-pointer flex-col gap-3 rounded-surface border bg-card p-2.5 transition-colors",
                    selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30",
                  )}
                >
                  <AppearancePreview value={option.value} />
                  <span className="flex items-center gap-2.5 px-1 pb-0.5">
                    <RadioGroupItem id={`appearance-${option.value}`} value={option.value} />
                    <span className="flex-1 type-label font-semibold text-foreground">{t(option.value)}</span>
                    <Icon aria-hidden className="size-4 text-muted-foreground" />
                  </span>
                </label>
              );
            })}
          </RadioGroup>
        </SettingsBlock>

        <SettingsBlock title={t("language")} meta={t("yourAccount")}>
          <SettingsRows>
            <SettingsRow
              label={t("language")}
              description={
                languageFailed ? (
                  <span role="alert" className="text-destructive">
                    {t("languageNotSaved")}
                  </span>
                ) : undefined
              }
            >
              <ToggleGroup
                type="single"
                aria-label={t("language")}
                value={mounted ? language : ""}
                disabled={savingLanguage}
                onValueChange={(next) => {
                  if (!isLocale(next) || next === language) return;
                  void chooseLanguage(next);
                }}
                className="rounded-control border border-border bg-inlay p-0.5"
                spacing={1}
                size="sm"
              >
                {LANGUAGES.map((language) => (
                  <ToggleGroupItem
                    key={language.value}
                    value={language.value}
                    lang={language.value}
                    className="rounded-nested px-3 font-semibold data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-raised"
                  >
                    {language.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </SettingsRow>
          </SettingsRows>
        </SettingsBlock>
      </SettingsPage>
    </div>
  );
}
