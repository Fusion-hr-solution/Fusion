# @repo/api

Shared HTTP client for the EY HR Platform. All MFEs use this to talk to the backend gateway.

Every request is proxied through the shell:

```
/performance/evaluations → shell (/api rewrite) → gateway:5000/api/performance/evaluations
```

Never hardcode `localhost`. Pass paths like `/performance/evaluations` — the client prefixes `/api`.

---

## Setup

Create `src/lib/api.ts` in your MFE. One file, copy exactly:

```ts
import { createPlatformApiClient } from "@repo/api";

export const api = createPlatformApiClient();
```

Do not call `createPlatformApiClient` anywhere else — only in `lib/api.ts`.

---

## Usage

Always import `api` from your local `lib/api.ts`. Never import from `@repo/api` directly in components or services.

```ts
import { api } from "@/lib/api";

// GET
const evaluations = await api.get<Evaluation[]>("/performance/evaluations");

// POST
const evaluation = await api.post<Evaluation>("/performance/evaluations", {
  employeeId: 1,
  rating: 4,
});

// PUT / PATCH / DELETE
await api.put("/performance/evaluations/42", { rating: 5 });
await api.patch("/performance/evaluations/42", { rating: 5 });
await api.delete("/performance/evaluations/42"); // returns undefined
```

### Cancellation

```ts
const controller = new AbortController();
await api.get("/performance/evaluations", { signal: controller.signal });
controller.abort();
```

### Skip auth (public endpoints)

```ts
await api.get("/public/health", { skipAuth: true });
```

---

## Error handling

```ts
import { ApiError } from "@repo/api";

try {
  await api.post("/identity/auth/login", { email, password });
} catch (err) {
  if (err instanceof ApiError) {
    // err.status, err.statusText, err.errors[], err.correlationId
  } else if (err instanceof TypeError) {
    // offline / DNS failure — no response received
  } else if (err instanceof DOMException) {
    // request cancelled via AbortController
  }
}
```

Always handle `TypeError`. If the user is offline, `ApiError` is never thrown.

---

## Folder structure

Every MFE must follow this layout — no exceptions:

```
src/
  lib/
    api.ts                  ← createPlatformApiClient() lives here, nowhere else
  services/
    evaluations.ts          ← one file per domain: typed wrappers around api calls
    goals.ts
  components/
    EvaluationList.tsx      ← imports from services, never from lib/api directly
```

**The rule:** components call services, services call `api`. This means when an endpoint path changes, you update one service file — nothing in your components breaks.

```ts
// src/services/evaluations.ts
import { api } from "@/lib/api";
import type { Evaluation } from "@/types";

export const getEvaluations = () =>
  api.get<Evaluation[]>("/performance/evaluations");

export const createEvaluation = (data: {
  employeeId: number;
  rating: number;
}) => api.post<Evaluation>("/performance/evaluations", data);

export const deleteEvaluation = (id: number) =>
  api.delete(`/performance/evaluations/${id}`);
```

```ts
// src/components/EvaluationList.tsx
import { getEvaluations } from "@/services/evaluations"; // ✓ correct
import { api } from "@/lib/api"; // ✗ never do this in a component
```

---

## API reference

### `createPlatformApiClient(config?)`

| Option     | Default                                | Description                             |
| ---------- | -------------------------------------- | --------------------------------------- |
| `baseUrl`  | `NEXT_PUBLIC_API_BASE_URL` or `"/api"` | Base URL for all requests               |
| `getToken` | Reads `localStorage.access_token`      | Called per-request for the bearer token |

### `createApiClient(config?)` — advanced

Use when you need a second client (different base URL, custom headers, SSR).

| Option           | Default  | Description                       |
| ---------------- | -------- | --------------------------------- |
| `baseUrl`        | `"/api"` | Base URL for all requests         |
| `getToken`       | —        | Bearer token callback             |
| `defaultHeaders` | —        | Headers merged into every request |

### `RequestOptions` — per-request overrides

| Option        | Description                                       |
| ------------- | ------------------------------------------------- |
| `headers`     | Merged over `defaultHeaders`                      |
| `credentials` | Fetch credentials mode (default: `"same-origin"`) |
| `signal`      | `AbortSignal` for cancellation                    |
| `skipAuth`    | Skip the `Authorization` header                   |

### `ApiError` properties

| Property        | Type             | Description                       |
| --------------- | ---------------- | --------------------------------- |
| `status`        | `number`         | HTTP status code                  |
| `statusText`    | `string`         | HTTP status text                  |
| `errors`        | `string[]`       | Messages from the backend         |
| `correlationId` | `string \| null` | Trace ID — include in bug reports |
