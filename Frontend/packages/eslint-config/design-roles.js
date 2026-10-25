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
 * Dates: never in the browser's own locale (`toLocaleDateString(undefined, …)`), which made one page say
 * "Oct 20, 2026" and the next "20 Oct"; format through `@repo/ds/lib/dates`.
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

const radiusMessage = "Use a radius role: rounded-control / surface / inset / nested / detail / full.";
const typeMessage =
  "Unknown type role. Use type-display / page-title / section-title / subsection-title / panel-title / body / body-secondary / narrative / label / meta / eyebrow / metric / code.";
const dateMessage = "Format dates with @repo/ds/lib/dates (formatDate, formatDateTime, formatDateRange, formatRelative), not the browser's locale.";
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
      { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/][arguments.0.type='Identifier'][arguments.0.name='undefined']", message: dateMessage },
      { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat'][arguments.0.type='Identifier'][arguments.0.name='undefined']", message: dateMessage },
    ],
  },
};
