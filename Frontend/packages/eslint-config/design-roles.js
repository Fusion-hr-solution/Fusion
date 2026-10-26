/**
 * Design-role guards for Fusion-owned apps: geometry and surface tone express a role, never a number.
 * Both guards share one `no-restricted-syntax` entry, because ESLint replaces (not merges) a rule's
 * options when two configs set it.
 *
 * Radius: rounded-{detail,control,control-sm,surface,menu,inset,nested,full,none} (any side/variant).
 * Surface tone: canvas → bg-section → bg-card → bg-inlay (overlays: bg-popover), each nested level
 * lighter. Translucent neutral fills at rest (bg-muted/30, bg-background/90…) composite differently
 * on every parent, so they are reserved for state variants (hover:, data-*:), which this does not match.
 * Typography: only the semantic type-* roles defined in packages/ds (a misspelt role silently
 * falls back to body text).
 * Dates and numbers: never in the browser's own locale (`toLocaleDateString(undefined, …)`), which made one page
 * say "Oct 20, 2026" and the next "20 Oct", and never in a locale named on the spot ("en-GB"); format through
 * `@repo/ds/lib/dates` and `@repo/ds/lib/numbers`, which hold the one locale.
 * Direction: layout follows the writing direction, so Arabic lays itself out from the same code. A left/right
 * utility with a start/end form warns and names it. Centring offsets (left-1/2), translate-x, inset-x, space-x and
 * anything under an explicit ltr: or rtl: variant are left alone.
 * See the radius, surface and type blocks in packages/ds/src/styles/tokens.css and DESIGN.md.
 */
const RAW_RADIUS =
  "/(^|\\s|:|!)rounded(-(t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee))?(-(xs|sm|md|lg|xl|2xl|3xl|4xl|object|affordance|feature)|-\\[[^\\]]*\\])?!?(\\s|$)/";
const TRANSLUCENT_TONE = "/(^|\\s|!)bg-(muted|background|card|secondary|accent|popover)\\x2F/";

// The type roles are read from the DS stylesheet's `@utility type-*` declarations, so adding a role
// there is the only step; a misspelt or nonexistent role in an app then warns instead of silently
// falling back to body text.
const TYPE_ROLES = [
  ...require("fs")
    .readFileSync(require("path").join(__dirname, "../ds/src/styles/tokens.css"), "utf8")
    .matchAll(/@utility type-([a-z0-9-]+)/g),
]
  .map((m) => m[1])
  .sort((a, b) => b.length - a.length);
const UNKNOWN_TYPE_ROLE = `/(^|\\s|:|!)type-(?!(${TYPE_ROLES.join("|")})(\\s|$))[a-z0-9-]+/`;

// Each physical utility family, and the start/end form that replaces it. A token may carry variants
// (`md:hover:`), `!` and a negative sign; one under `ltr:` or `rtl:` is deliberate and never matches.
const TOKEN_START = String.raw`(^|\s)(?!(?:[^\s:]+:)*(?:ltr|rtl):)(?:[^\s:]+:)*!?-?`;
const SPACING = String.raw`-(\d|px|auto|\[|\()`;
const INSET = String.raw`-(?!1\x2F2(\s|$))(\d|px|auto|full|\[|\()`;
const WHOLE = String.raw`(\s|$)`;
const SIDE = String.raw`(-|\s|$)`;
// [physical, logical, what follows the family name]
const DIRECTION_FAMILIES = [
  ["ml", "ms", SPACING],
  ["mr", "me", SPACING],
  ["pl", "ps", SPACING],
  ["pr", "pe", SPACING],
  ["scroll-ml", "scroll-ms", SPACING],
  ["scroll-mr", "scroll-me", SPACING],
  ["scroll-pl", "scroll-ps", SPACING],
  ["scroll-pr", "scroll-pe", SPACING],
  ["left", "inset-s", INSET],
  ["right", "inset-e", INSET],
  ["text-left", "text-start", WHOLE],
  ["text-right", "text-end", WHOLE],
  ["float-left", "float-start", WHOLE],
  ["float-right", "float-end", WHOLE],
  ["border-l", "border-s", SIDE],
  ["border-r", "border-e", SIDE],
  ["rounded-l", "rounded-s", SIDE],
  ["rounded-r", "rounded-e", SIDE],
  ["rounded-tl", "rounded-ss", SIDE],
  ["rounded-tr", "rounded-se", SIDE],
  ["rounded-bl", "rounded-es", SIDE],
  ["rounded-br", "rounded-ee", SIDE],
];
const directionGuards = DIRECTION_FAMILIES.flatMap(([physical, logical, rest]) => {
  const regex = `/${TOKEN_START}${physical}${rest}/`;
  const [from, to] = rest === WHOLE ? [physical, logical] : [`${physical}-*`, `${logical}-*`];
  const message = `Layout follows the writing direction: use ${to} instead of ${from} (ltr: or rtl: when it is truly physical).`;
  return [
    { selector: `Literal[value=${regex}]`, message },
    { selector: `TemplateElement[value.raw=${regex}]`, message },
  ];
});

const radiusMessage = "Use a radius role: rounded-control / surface / inset / nested / detail / full.";
const typeMessage =
  "Unknown type role. Use type-display / page-title / section-title / subsection-title / panel-title / body / body-secondary / narrative / label / meta / eyebrow / metric / code.";
const dateMessage =
  "Format dates with @repo/ds/lib/dates (formatDate, formatDateTime, formatDateRange, formatRelative, formatDateParts): it holds Fusion's one locale.";
const numberMessage = "Format numbers with @repo/ds/lib/numbers (formatNumber, formatPercent, formatCount): it holds Fusion's one locale.";
const localeMessage =
  "Format through @repo/ds/lib/dates or @repo/ds/lib/numbers: they hold Fusion's one locale, so nothing names its own or uses the browser's.";

// A fixed locale ("en-GB") or the browser's (undefined, or no argument) outside the shared formatters. Those name
// their locale through a constant, which this does not match.
const OWN_LOCALE = "[arguments.0.type='Literal']";
const BROWSER_LOCALE = "[arguments.0.type='Identifier'][arguments.0.name='undefined']";
const formattingGuards = [OWN_LOCALE, BROWSER_LOCALE].flatMap((locale) => [
  { selector: `:matches(NewExpression, CallExpression)[callee.object.name='Intl'][callee.property.name=/^(DateTimeFormat|RelativeTimeFormat)$/]${locale}`, message: dateMessage },
  { selector: `:matches(NewExpression, CallExpression)[callee.object.name='Intl'][callee.property.name='NumberFormat']${locale}`, message: numberMessage },
  { selector: `CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]${locale}`, message: dateMessage },
  { selector: `CallExpression[callee.property.name='toLocaleString']${locale}`, message: localeMessage },
]).concat([
  { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/][arguments.length=0]", message: dateMessage },
  { selector: "CallExpression[callee.property.name='toLocaleString'][arguments.length=0]", message: localeMessage },
]);
const toneMessage =
  "Use a surface tone: bg-section / bg-card / bg-inlay (bg-popover in overlays). Translucent neutrals are for state variants only.";

/** @type {import("eslint").Linter.Config} */
module.exports = {
  rules: {
    "no-restricted-syntax": [
      "warn",
      { selector: `Literal[value=${RAW_RADIUS}]`, message: radiusMessage },
      { selector: `TemplateElement[value.raw=${RAW_RADIUS}]`, message: radiusMessage },
      { selector: `Literal[value=${TRANSLUCENT_TONE}]`, message: toneMessage },
      { selector: `TemplateElement[value.raw=${TRANSLUCENT_TONE}]`, message: toneMessage },
      { selector: `:not(JSXAttribute[name.name=/^(id|htmlFor|name)$/]) > Literal[value=${UNKNOWN_TYPE_ROLE}]`, message: typeMessage },
      { selector: `TemplateElement[value.raw=${UNKNOWN_TYPE_ROLE}]`, message: typeMessage },
      ...formattingGuards,
      ...directionGuards,
    ],
  },
};
