import { useCallback } from "react";
import { createTranslator, useTranslations, type AbstractIntlMessages } from "next-intl";

/**
 * Says one line of a catalogue namespace ("consequence.required"), filled with its values. Pure helpers that word
 * things (what saving does, a list's summary sentence) take one, English by default, so they can be tested without
 * rendering; components pass {@link useSay}'s.
 */
export type Say = (key: string, values?: Record<string, string | number | Date>) => string;

/** A namespace of an English catalogue, for code outside a translated tree (pure helpers' defaults, tests). */
export function englishSay(messages: AbstractIntlMessages, namespace: string): Say {
  const t = createTranslator({ locale: "en", messages, namespace: namespace as never });
  return (key, values) => t(key as never, values as never);
}

/** A namespace in the person's language. Stable while the language is. */
export function useSay(namespace: string): Say {
  const t = useTranslations(namespace as never);
  return useCallback<Say>((key, values) => t(key as never, values as never), [t]);
}
