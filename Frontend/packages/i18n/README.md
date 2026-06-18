# @repo/i18n

Shared internationalization (i18n) configuration for the platform's
microfrontends, built on [`next-intl`](https://next-intl.dev) v4 with
**cookie-based** locale selection (no `/en` `/fr` URL prefixes).

It provides the module-agnostic pieces — supported locales, the cookie name,
the default locale + time zone, the `setLocale` server action, and a factory
for the next-intl request config. **Each module keeps its own message
catalogs** (`messages/en.json`, `messages/fr.json`); only the wiring is shared.

The learning module is the reference consumer.

## What's exported

| Import                                            | Use from              | Contents                                                                 |
| ------------------------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `@repo/i18n`                                       | client **or** server  | `LOCALES`, `DEFAULT_LOCALE`, `LOCALE_COOKIE`, `DEFAULT_TIME_ZONE`, `isLocale`, `type Locale` (client-safe — no server-only imports) |
| `@repo/i18n/request`                               | server only           | `createI18nRequestConfig({ loadMessages, timeZone? })`, `resolveLocale()` |
| `@repo/i18n/locale`                                | server action module  | `setLocale(locale)` — persists the `NEXT_LOCALE` cookie                   |

## Adopting it in another module

> Adding i18n to a module is opt-in. These steps are illustrative — the shared
> package itself does not modify any module.

1. **Depend on it** in the app's `package.json` and transpile it:

   ```jsonc
   // package.json
   "dependencies": { "@repo/i18n": "workspace:*", "next-intl": "^4.13.0" }
   ```

   ```ts
   // next.config.ts
   transpilePackages: ["@repo/i18n", /* …existing… */],
   export default createNextIntlPlugin()(nextConfig);
   ```

2. **Add the request config** the plugin looks for:

   ```ts
   // src/i18n/request.ts
   import { createI18nRequestConfig } from "@repo/i18n/request";

   export default createI18nRequestConfig({
     loadMessages: async (locale) =>
       (await import(`../../messages/${locale}.json`)).default,
   });
   ```

3. **Provide the messages** in the root layout (server component):

   ```tsx
   import { NextIntlClientProvider } from "next-intl";
   import { getLocale, getMessages } from "next-intl/server";

   const locale = await getLocale();
   const messages = await getMessages();
   // <html lang={locale}> … <NextIntlClientProvider messages={messages}>
   ```

4. **Switch locale** from a client component:

   ```tsx
   "use client";
   import { useTransition } from "react";
   import { useRouter } from "next/navigation";
   import { LOCALES, type Locale } from "@repo/i18n";
   import { setLocale } from "@repo/i18n/locale";

   const [, startTransition] = useTransition();
   const router = useRouter();
   const switchTo = (next: Locale) =>
     startTransition(async () => {
       await setLocale(next);
       router.refresh();
     });
   ```

5. **Add the catalogs** — `messages/en.json` and `messages/fr.json` — and read
   strings with `useTranslations` / dates and numbers with `useFormatter`.

## Adding a locale

Add the code to `LOCALES` in `src/config.ts` here, then make sure every module
ships a matching `messages/<code>.json`. Keeping the catalogs at parity is each
module's responsibility (the learning module has a `pnpm check:i18n` gate).
