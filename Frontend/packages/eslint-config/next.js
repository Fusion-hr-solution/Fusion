/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    "./base",
    "next/core-web-vitals",
    "prettier",
  ],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
  },
};
