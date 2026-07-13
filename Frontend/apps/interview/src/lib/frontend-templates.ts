// Starter templates + helpers for "Frontend Project" questions. Each template is a normal
// multi-file Project ({ entry, files }) — the same shape the coding IDE already uses — so the
// file explorer, useProjectModel, and answer persistence are all reused unchanged.
//
// The templates are intentionally minimal but runnable. Every template exposes a `dev` script so
// the sandbox can boot uniformly with `npm run dev`; WebContainers reports the served URL via its
// `server-ready` event regardless of the port.

import type { FileSystemTree } from "@webcontainer/api";
import { parseProject } from "./project";
import type { Project, ProjectFile } from "./project";

export type FrontendFramework = "react" | "angular" | "next";

export function normalizeFramework(value?: string | null): FrontendFramework {
  switch ((value ?? "").trim().toLowerCase()) {
    case "angular":
      return "angular";
    case "next":
    case "next.js":
    case "nextjs":
      return "next";
    default:
      return "react";
  }
}

/** Command that boots the framework's dev server inside the WebContainer. */
export function frameworkDevCommand(_framework: FrontendFramework): [string, string[]] {
  // Uniform: every template defines an npm "dev" script.
  return ["npm", ["run", "dev"]];
}

/** Default command the Phase-2 server-side grader runs (author test suite). Stored for later. */
export function frameworkTestCommand(_framework: FrontendFramework): string {
  return "npm test";
}

/** The filename pattern the grading runner uses to DISCOVER tests (see docker/frontend-runner/). */
export function testFilePattern(framework: FrontendFramework): {
  matches: (path: string) => boolean;
  hint: string;
} {
  if (framework === "angular") {
    return { matches: (p) => /\.spec\.ts$/i.test(p.trim()), hint: "*.spec.ts" };
  }
  return {
    matches: (p) => /\.(test|spec)\.(js|jsx|ts|tsx)$/i.test(p.trim()),
    hint: "*.test.jsx / *.spec.tsx",
  };
}

/**
 * Validates a Frontend Project question's starter + hidden grading tests, catching the two ways an
 * author can silently ship an UNGRADEABLE question (both observed in practice):
 *
 *  1. A grading test reuses a starter file's path. At grade time the author's tests are overlaid ON
 *     TOP of the candidate's files (author wins, so tests can't be faked) — so a shared path deletes
 *     the candidate's code, usually the very file the tests import. Every submission then fails to
 *     compile.
 *  2. No grading test matches the runner's discovery glob (the file editor defaults new files to
 *     "module.py"). The runner finds zero tests, so every submission is punted to human review.
 *
 * Returns an error message, or null when the question is gradeable. No grading tests at all is
 * valid — that's the human-review path.
 */
export function validateFrontendQuestion(input: {
  framework?: string;
  projectFiles?: string;
  frontendTestFiles?: string;
}): string | null {
  const framework = (input.framework ?? "").trim();
  if (!framework) {
    return "Framework is required for Frontend Project questions.";
  }

  const tests = parseProject(input.frontendTestFiles);
  if (!tests) {
    return null; // no grading tests → graded by human review, which is a valid choice
  }

  const starter = parseProject(input.projectFiles);
  const starterPaths = new Set((starter?.files ?? []).map((f) => f.path.trim().toLowerCase()));

  const clash = tests.files.find((f) => starterPaths.has(f.path.trim().toLowerCase()));
  if (clash) {
    return `Grading test "${clash.path}" uses the same path as a starter file. At grading time it would overwrite the candidate's code — rename one of them.`;
  }

  const { matches, hint } = testFilePattern(normalizeFramework(framework));
  if (!tests.files.some((f) => matches(f.path))) {
    return `No grading test file matches ${hint}. The runner would find zero tests, so every submission would go to human review instead of being scored.`;
  }

  return null;
}

/** Convert a flat file list into the nested tree WebContainers' `mount` expects. */
export function toFileSystemTree(files: ProjectFile[]): FileSystemTree {
  const root: FileSystemTree = {};
  for (const file of files) {
    const parts = file.path.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) continue;
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i]!;
      const existing = node[dir];
      if (!existing || !("directory" in existing)) {
        node[dir] = { directory: {} };
      }
      node = (node[dir] as { directory: FileSystemTree }).directory;
    }
    node[parts[parts.length - 1]!] = { file: { contents: file.content } };
  }
  return root;
}

const REACT_TEMPLATE: Project = {
  entry: "src/App.jsx",
  files: [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "react-challenge",
          private: true,
          type: "module",
          scripts: { dev: "vite --host", build: "vite build", test: "vitest run" },
          dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
          devDependencies: { "@vitejs/plugin-react": "^4.3.1", vite: "^5.4.8" },
        },
        null,
        2,
      ),
    },
    {
      path: "vite.config.js",
      content: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()] });\n`,
    },
    {
      path: "index.html",
      content: `<!doctype html>\n<html>\n  <head><meta charset="utf-8" /><title>React Challenge</title></head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
    },
    {
      path: "src/main.jsx",
      content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\n\ncreateRoot(document.getElementById("root")).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n`,
    },
    {
      path: "src/App.jsx",
      content: `export default function App() {\n  return <h1>Edit src/App.jsx to start</h1>;\n}\n`,
    },
  ],
};

const NEXT_TEMPLATE: Project = {
  entry: "app/page.tsx",
  files: [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "next-challenge",
          private: true,
          scripts: { dev: "next dev", build: "next build", test: "vitest run" },
          dependencies: { next: "^14.2.5", react: "^18.3.1", "react-dom": "^18.3.1" },
        },
        null,
        2,
      ),
    },
    {
      path: "next.config.js",
      content: `/** @type {import('next').NextConfig} */\nmodule.exports = {};\n`,
    },
    {
      path: "app/layout.tsx",
      content: `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
    },
    {
      path: "app/page.tsx",
      content: `export default function Page() {\n  return <h1>Edit app/page.tsx to start</h1>;\n}\n`,
    },
  ],
};

const ANGULAR_TEMPLATE: Project = {
  entry: "src/app/app.component.ts",
  files: [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "angular-challenge",
          private: true,
          scripts: { dev: "ng serve", build: "ng build", test: "ng test" },
          dependencies: {
            "@angular/core": "^18.2.0",
            "@angular/common": "^18.2.0",
            "@angular/compiler": "^18.2.0",
            "@angular/platform-browser": "^18.2.0",
            "@angular/platform-browser-dynamic": "^18.2.0",
            rxjs: "^7.8.1",
            "zone.js": "^0.14.10",
          },
          devDependencies: { "@angular/cli": "^18.2.0", "@angular/compiler-cli": "^18.2.0", typescript: "~5.5.4" },
        },
        null,
        2,
      ),
    },
    {
      path: "angular.json",
      content: JSON.stringify(
        {
          version: 1,
          projects: {
            app: {
              projectType: "application",
              root: "",
              sourceRoot: "src",
              architect: {
                build: { builder: "@angular-devkit/build-angular:application", options: { browser: "src/main.ts", index: "src/index.html", tsConfig: "tsconfig.json" } },
                serve: { builder: "@angular-devkit/build-angular:dev-server" },
              },
            },
          },
        },
        null,
        2,
      ),
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        { compilerOptions: { target: "ES2022", module: "ES2022", experimentalDecorators: true, strict: true, moduleResolution: "bundler" } },
        null,
        2,
      ),
    },
    {
      path: "src/index.html",
      content: `<!doctype html>\n<html lang="en">\n  <head><meta charset="utf-8" /><title>Angular Challenge</title></head>\n  <body><app-root></app-root></body>\n</html>\n`,
    },
    {
      path: "src/main.ts",
      content: `import { bootstrapApplication } from "@angular/platform-browser";\nimport { AppComponent } from "./app/app.component";\n\nbootstrapApplication(AppComponent);\n`,
    },
    {
      path: "src/app/app.component.ts",
      content: `import { Component } from "@angular/core";\n\n@Component({\n  selector: "app-root",\n  standalone: true,\n  template: "<h1>Edit src/app/app.component.ts to start</h1>",\n})\nexport class AppComponent {}\n`,
    },
  ],
};

/** The starter project seeded when an author creates a Frontend Project question. */
export function frameworkStarterProject(framework: FrontendFramework): Project {
  switch (framework) {
    case "angular":
      return structuredClone(ANGULAR_TEMPLATE);
    case "next":
      return structuredClone(NEXT_TEMPLATE);
    default:
      return structuredClone(REACT_TEMPLATE);
  }
}
