/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    pool: "threads",
    minWorkers: 1,
    maxWorkers: 2,
    fileParallelism: true,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
