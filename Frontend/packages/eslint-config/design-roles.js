/**
 * Design-role guards for every Fusion-owned app; the guards and their reasons are in design-roles-guards.js.
 * @type {import("eslint").Linter.Config}
 */
const { guards } = require("./design-roles-guards");

module.exports = {
  rules: { "no-restricted-syntax": ["warn", ...guards] },
};
