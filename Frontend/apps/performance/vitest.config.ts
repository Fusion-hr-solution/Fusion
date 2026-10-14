/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Match Next's automatic JSX runtime, so components need no React import to render under test.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [{ find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") }],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
