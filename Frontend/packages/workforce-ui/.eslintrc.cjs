module.exports = {
  root: true,
  extends: ["@repo/eslint-config/base"],
  parserOptions: {
    project: true,
  },
  ignorePatterns: ["dist"],
};
