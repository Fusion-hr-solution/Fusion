module.exports = {
  root: true,
  extends: ["@repo/eslint-config/base"],
  parserOptions: {
    project: true,
  },
  ignorePatterns: ["vitest.config.ts", "src/__tests__"],
};
