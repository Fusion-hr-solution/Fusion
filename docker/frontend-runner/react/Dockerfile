# syntax=docker/dockerfile:1
# React grading image — candidate builds a React app; tests run with Vitest + Testing Library (jsdom).
# Build (context = docker/frontend-runner):
#   docker build -f react/Dockerfile -t interview-frontend-react:1 .
FROM node:20-slim

# Non-root sandbox user.
RUN useradd -m -u 10001 runner

# ── App template: framework + test tooling. node_modules is BAKED so grading needs NO network. ──
WORKDIR /opt/app-template
RUN cat > package.json <<'JSON'
{
  "name": "react-runner-template",
  "private": true,
  "type": "module",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "vitest": "^2.1.8",
    "jsdom": "^25.0.1",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@vitejs/plugin-react": "^4.3.4"
  }
}
JSON
RUN npm install --no-audit --no-fund --loglevel=error && npm cache clean --force

# ── Image-controlled test config, re-applied AFTER the submission by the entrypoint so a candidate
#    cannot swap out jsdom or the reporters. ──
RUN mkdir -p /opt/runner/config
RUN cat > /opt/runner/config/vitest.runner.config.ts <<'TS'
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  cacheDir: "/tmp/.vite",
  test: {
    environment: "jsdom",
    globals: true,
    // Relative to the config's dir (/work). Vite resolves a leading "/" as a root-relative URL,
    // not a filesystem path — so it can NOT load /opt/... here. The entrypoint copies this file
    // into /work AFTER the submission, so it stays tamper-proof.
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{js,jsx,ts,tsx}"],
    watch: false,
  },
});
TS
RUN cat > /opt/runner/config/vitest.setup.ts <<'TS'
import "@testing-library/jest-dom/vitest";
TS

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY parse-report.js /usr/local/bin/parse-report.js
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV RUNNER_KIND=vitest
USER runner
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
