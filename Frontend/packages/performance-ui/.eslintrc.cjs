module.exports = {
  root: true,
  extends: ["@repo/eslint-config/base", "@repo/eslint-config/design-roles"],
  parserOptions: {
    project: true,
  },
  ignorePatterns: ["dist", "vitest.config.ts"],
};
