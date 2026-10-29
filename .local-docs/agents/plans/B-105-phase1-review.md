# B-105 phase 1 — the language groundwork (`add-i18n-foundation`): what to look at

Applied 2026-10-25, uncommitted. 13/13 tasks; `openspec validate add-i18n-foundation --strict` passes. Screens: `plans/B-105-screens/` (dark, 1440×900, through the shell; `log.json` beside them).

## Look at

- [ ] **French, end to end.** `fr-preferences.png`: Preferences after choosing Français. The page, the breadcrumb root ("Paramètres"), "Retour à Core HR" and the You group are French; "Enregistré" confirms. Wording to judge: Apparence · Cet appareil, Sombre / Clair / Comme cet appareil, Langue · Votre compte.
- [ ] **French stops where phase 1 stops.** `fr-core-settings-company.png`: in Core HR's settings mode the shared parts are French, Core's own sections and the Company page stay English. `fr-performance-plan-untranslated.png`: My Plan unchanged.
- [ ] **English looks as before.** `en-home`, `en-performance-plan`, `en-core-people`, `en-settings-company`, `en-platform-tenants`, `en-preferences`. I compared Home and My Plan with `B-089-screens/after/` and found no layout difference (only data and dates differ).
- [ ] **Arabic-direction preview.** `rtl-home.png`, `rtl-performance-plan.png`: forced `dir="rtl"` + `lang="ar"` (a capture-only toggle). Sidebar, active marks, cards, rails, progress, timeline dots mirror. English text inside reads oddly ("?How did…", "Performance1:1") because it is English in a right-to-left page; Arabic text won't.
- [ ] **One wording change on Preferences:** the Language block now says "Your account" instead of "This device".

## Try by hand (optional)

1. Sign in as Amira, Settings › Preferences, choose Français: the page turns French without a reload. Open Core HR: its settings sidebar parts are French.
2. Sign in on another browser as Amira: Preferences opens in French (the choice lives on the account).
3. Choose English again.

## Small output changes you may notice

- Data import upload: "Modified today at 10:24" (was "10:24 AM").
- Platform hover titles and the activation expiry use the shared grammar ("Tue 20 Oct 2026, 11:00").
- Measurement values from a million read "1.2m" (en-GB) where an en-US browser showed "1.2M".

## Decisions taken during the apply

- Logical insets are `inset-s-*`/`inset-e-*` (Tailwind's current names; `start-*`/`end-*` are deprecated).
- The CSS build turns logical insets into left/right keyed on `:lang(ar …)`, so a right-to-left page needs `lang` set too. Fine for the Arabic phase, which sets both; noted on the board.
- Sheet/sidebar sides set explicitly (`data-[side=left|right]`), slide animations and time-axis charts stay physical until the Arabic phase.
- No local tenant has an `fr-FR` locale; the company-default French case is covered by Identity's tests, not the journey.
