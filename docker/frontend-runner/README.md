# Frontend Project grading images

Sandboxed runner images for auto-grading **Frontend Project** interview questions. The Interview
service (`DockerFrontendProjectRunner`) runs one of these images per submission: it mounts the
candidate's code + the author's hidden tests, runs the tests, and reads a score back from stdout.

These images are the concrete implementation of the contract documented in
`Backend/EY.HRPlatform.Interview/Features/Grading/FrontendRunner/`.

## Contract

The Interview service invokes an image roughly like this:

```
docker run --rm --network none --cpus 1 --memory 1024m --memory-swap 1024m --pids-limit 256 \
  --security-opt no-new-privileges --cap-drop ALL --read-only \
  --tmpfs /work:rw,size=96m,mode=1777 --tmpfs /tmp:rw,size=256m,mode=1777 \
  -v <submission>:/submission:ro \
  interview-frontend-react:1
```

Each image must:
1. Read the submission (candidate source **+** author test files, already merged with author paths
   winning) from the read-only mount `/submission`.
2. Assemble a runnable tree in the writable tmpfs `/work`, with `node_modules` **baked into the
   image** (no network at run time) — the shared `entrypoint.sh` symlinks it from
   `/opt/app-template/node_modules`.
3. Re-apply the image-controlled test config **after** the submission so a candidate can't disable
   the test environment or reporters.
4. Run the test runner with a **JSON** reporter to `/tmp/report.json`, **without** letting a test
   failure abort the script.
5. Print exactly one line `##RESULT##{"total":N,"passed":M}` and exit `0`.
   Exit `2` signals an install/setup failure (→ the grader queues the attempt for human review).

`parse-report.js` produces the `{total,passed}`; `entrypoint.sh` drives the run and is shared by all
images (`RUNNER_KIND=vitest|jest`). Only the `##RESULT##` line is the contract with the C# grader —
the report format is an internal detail of the image.

### Why JSON, not JUnit

A suite that fails to **collect** (syntax error, bad import, broken config) is emitted by JUnit as a
single failed test case. That is indistinguishable from "the candidate failed their one test", so a
compile error would silently score **0** — and an image/config fault of *ours* would silently zero
*every* candidate.

Vitest and Jest both emit a JSON report in Jest's schema, which separates the two
(`numTotalTests`, `numRuntimeErrorTestSuites`, per-suite `assertionResults`). So:

| Outcome | `##RESULT##` | Grader |
|---|---|---|
| 3 of 4 tests passed | `{"total":4,"passed":3}` | auto-score 75% |
| all tests failed (but they ran) | `{"total":4,"passed":0}` | auto-score 0 |
| suite never collected (compile error) | `{"total":0,"passed":0}` | **human review** |
| no/unreadable report | `{}` | **human review** |

This mapping is the difference between "candidate wrote broken code" (score it 0) and "our image is
broken" (never silently zero a candidate — escalate). It's covered by tests; no Docker needed:

```bash
node test-parse-report.js     # 9/9
```

## Build

Build with the **context set to this directory** (so the shared scripts are in scope):

```bash
cd docker/frontend-runner
docker build -f react/Dockerfile   -t interview-frontend-react:1   .
docker build -f next/Dockerfile    -t interview-frontend-next:1    .
docker build -f angular/Dockerfile -t interview-frontend-angular:1 .
```

## Wire it into the Interview service

Enable the runner + map each framework to its image (appsettings / env):

```jsonc
{
  "FrontendRunner": {
    "Enabled": true,
    "DockerPath": "docker",
    "Network": "none",
    "CpuLimit": 1.0,
    "MemoryLimitMb": 1024,
    "PidsLimit": 256,
    "TimeoutSeconds": 120,
    "Images": {
      "react":   "interview-frontend-react:1",
      "next":    "interview-frontend-next:1",
      "angular": "interview-frontend-angular:1"
    }
  }
}
```

With `Enabled=false` (default) no runner/grader is registered and Frontend Project questions fall
through to human review.

## Security posture

- **No network** (`--network none`) — deps are baked in, so no registry/internet is reachable.
- **Non-root** (`uid 10001`), **all capabilities dropped**, **no privilege escalation**.
- **Read-only root fs**; only the size-capped tmpfs `/work` + `/tmp` are writable and RAM-backed.
- **CPU / memory (+ no swap) / pids** caps, plus a wall-clock timeout that force-removes the container.
- Ephemeral (`--rm`); the submission mount is read-only.
- The grading host needs Docker access — run the grading worker on an isolated node, since Docker
  socket access is root-equivalent on the host.

## Authoring grading tests

- **React / Next**: Vitest + `@testing-library/react` (jsdom). Name tests `*.test.tsx` / `*.spec.tsx`.
  Assertions from `@testing-library/jest-dom` are available.
- **Angular**: Jest via `jest-preset-angular` (jsdom). Name tests `*.spec.ts`.
- Author tests are stored on the question in the candidate-hidden `FrontendTestFiles` field and are
  overlaid on top of the candidate's files at grade time (author paths win), so candidates can't
  read, delete, or fake them.

## Caveats / to validate

- The **Angular** image is the most version-sensitive (Angular ⇄ jest-preset-angular ⇄ TypeScript).
  Pin versions to your Angular target before production use.
- **Next**: grade **components**, not full-app routing/server behaviour, or provide mocks in the tests.
- These images pull public npm packages at **build** time. For a fully air-gapped build, point npm
  at your internal mirror during `docker build`.
