/**
 * Design-role guards for Fusion-owned apps: geometry and surface tone express a role, never a number.
 * Both guards share one `no-restricted-syntax` entry, because ESLint replaces (not merges) a rule's
 * options when two configs set it.
 *
 * Radius: rounded-{detail,control,control-sm,surface,menu,inset,nested,full,none} (any side/variant).
 * Surface tone: canvas → bg-section → bg-card → bg-inlay (overlays: bg-popover), each nested level
 * lighter. Translucent neutral fills at rest (bg-muted/30, bg-background/90…) composite differently
 * on every parent, so they are reserved for state variants (hover:, data-*:), which this does not match.
 * See the radius and surface blocks in packages/ds/src/styles/tokens.css and DESIGN.md §8, §10.
 */
const RAW_RADIUS =
  "/(^|\\s|:|!)rounded(-(t|r|b|l|tl|tr|bl|br|s|e|ss|se|es|ee))?(-(xs|sm|md|lg|xl|2xl|3xl|4xl|object|affordance|feature)|-\\[[^\\]]*\\])?!?(\\s|$)/";
const TRANSLUCENT_TONE = "/(^|\\s|!)bg-(muted|background|card|secondary|accent|popover)\\x2F/";

const radiusMessage = "Use a radius role: rounded-control / surface / inset / nested / detail / full.";
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
    ],
  },
};
