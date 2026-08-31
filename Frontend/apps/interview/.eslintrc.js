module.exports = {
  root: true,
  extends: ["@repo/eslint-config/next"],
  overrides: [
    {
      // `src/services/` validates API *responses* (asQuestionType, asDifficulty, …). Those must
      // match against the canonical wire values in `@/config/constants`, never against admin
      // labels — a mismatch there silently rewrites data, which is how Frontend Project questions
      // once started displaying as "Essay".
      files: ["src/services/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/hooks/use-taxonomy", "**/hooks/use-taxonomy"],
                message:
                  "Response validation must use canonical values from @/config/constants. Admin-curated labels must never reach the as*() coercion functions.",
              },
            ],
          },
        ],
      },
    },
  ],
};
