/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the tsconfig path mapping: Core consumes UI primitives from @repo/ds via the
    // `@/components/ui/*` alias (its local components/ui was removed during the DS migration).
    // The more specific alias must come first.
    alias: [
      {
        find: /^@\/components\/ui\/(.*)$/,
        replacement: path.resolve(
          __dirname,
          "../../packages/ds/src/components/ui/$1"
        ),
      },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
    ],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    // The workspace test task runs every app in parallel on a 2-core CI runner, so a plain
    // synchronous render of a large workspace tree can sit just past the 5s default and fail
    // for scheduling reasons alone (access-people-workspace, ~5.9s on CI, instant locally).
    testTimeout: 20000,
  },
});
