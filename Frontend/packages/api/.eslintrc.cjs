module.exports = {
  root: true,
  extends: ["@repo/eslint-config/base"],
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [".eslintrc.cjs", "vitest.config.ts"],
};
