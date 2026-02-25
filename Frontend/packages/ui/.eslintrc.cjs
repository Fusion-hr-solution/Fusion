module.exports = {
  root: true,
  extends: ["@repo/eslint-config/base"],
  parserOptions: {
    project: true,
  },
  ignorePatterns: ["tailwind.config.ts", "postcss.config.mjs"],
};
