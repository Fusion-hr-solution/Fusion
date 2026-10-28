/**
 * The design-role guards plus raw typography, for apps already on type roles (Performance first). One config
 * carries every guard, since a second config setting this rule would replace its options.
 * @type {import("eslint").Linter.Config}
 */
const { guards, typographyGuards } = require("./design-roles-guards");

module.exports = {
  rules: { "no-restricted-syntax": ["warn", ...guards, ...typographyGuards] },
};
