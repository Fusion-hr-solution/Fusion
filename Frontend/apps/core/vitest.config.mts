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
  },
});
