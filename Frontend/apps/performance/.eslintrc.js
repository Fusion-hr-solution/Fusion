module.exports = {
  root: true,
  extends: ["@repo/eslint-config/next", "@repo/eslint-config/design-roles"],
  rules: {
    // Performance draws its icons from Hugeicons through one adapter, so glyph choices stay in one place.
    "no-restricted-imports": [
      "warn",
      { paths: [{ name: "lucide-react", message: "Import icons from \"@/lib/icons\" (Hugeicons adapter)." }] },
    ],
  },
};
