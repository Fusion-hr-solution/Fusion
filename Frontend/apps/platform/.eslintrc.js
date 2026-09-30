module.exports = {
  root: true,
  extends: ["@repo/eslint-config/next", "@repo/eslint-config/design-roles"],
  rules: {
    "no-restricted-imports": [
      "warn",
      { paths: [{ name: "lucide-react", message: "Import icons from \"@/lib/icons\" (Hugeicons adapter)." }] },
    ],
  },
};
