# syntax=docker/dockerfile:1
# Angular grading image — tests run headless with Jest via jest-preset-angular (jsdom).
# ⚠️ Angular + Jest is version-sensitive. The versions below target Angular 18; validate them against
#    your Angular target (and bump jest-preset-angular accordingly) before relying on this in prod.
# Build (context = docker/frontend-runner):
#   docker build -f angular/Dockerfile -t interview-frontend-angular:1 .
FROM node:20-slim

RUN useradd -m -u 10001 runner

WORKDIR /opt/app-template
RUN cat > package.json <<'JSON'
{
  "name": "angular-runner-template",
  "private": true,
  "dependencies": {
    "@angular/core": "^18.2.0",
    "@angular/common": "^18.2.0",
    "@angular/compiler": "^18.2.0",
    "@angular/platform-browser": "^18.2.0",
    "@angular/platform-browser-dynamic": "^18.2.0",
    "rxjs": "^7.8.1",
    "tslib": "^2.7.0",
    "zone.js": "^0.14.10"
  },
  "devDependencies": {
    "@angular/compiler-cli": "^18.2.0",
    "@types/jest": "^29.5.13",
    "jest": "^29.7.0",
    "jest-preset-angular": "^14.2.4",
    "typescript": "~5.5.4"
  }
}
JSON
RUN npm install --no-audit --no-fund --loglevel=error && npm cache clean --force

RUN mkdir -p /opt/runner/config
RUN cat > /opt/runner/config/jest.config.cjs <<'CJS'
// All paths use <rootDir> (= /work). The entrypoint copies this file in AFTER the submission, so it
// stays tamper-proof; an absolute /opt/... path would sit outside rootDir and break the transform.
module.exports = {
  preset: "jest-preset-angular",
  // Required by jest-preset-angular to bootstrap the Angular compiler before the suites run.
  globalSetup: "jest-preset-angular/global-setup",
  setupFilesAfterEnv: ["<rootDir>/setup-jest.ts"],
  testMatch: ["**/*.spec.ts"],
  cacheDirectory: "/tmp/jest",
  // Pin the transform explicitly so it uses OUR tsconfig, not whatever the candidate ships.
  transform: {
    "^.+\\.(ts|js|mjs|html|svg)$": [
      "jest-preset-angular",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        stringifyContentPathRegex: "\\.(html|svg)$",
      },
    ],
  },
};
CJS
RUN cat > /opt/runner/config/setup-jest.ts <<'TS'
import "jest-preset-angular/setup-jest";
TS
RUN cat > /opt/runner/config/tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "lib": ["ES2022", "dom"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "strict": false,
    "types": ["jest", "node"]
  }
}
JSON

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY parse-report.js /usr/local/bin/parse-report.js
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV RUNNER_KIND=jest
USER runner
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
