# @repo/api

Shared HTTP client for the EY HR Platform. Wraps `fetch`, adds auth headers, and unwraps the backend envelope automatically.

---

## How requests reach the backend

All API calls use relative URLs like `/api/...`. The **Shell** (`localhost:3000`) rewrites these to the gateway:

```
api.get("/performance/evaluations")
  → fetch("/api/performance/evaluations")   (relative, hits shell origin :3000)
  → Shell rewrite
  → http://localhost:5000/api/performance/evaluations
```

---

## Setup (do this once per MFE)

### 1. Add the dependency

In your MFE's `package.json`:

```json
"dependencies": {
  "@repo/api": "workspace:*"
}
```

Then add `"@repo/api"` to `transpilePackages` in your `next.config.ts`:

```ts
transpilePackages: ["@repo/ui",..., "@repo/api"],
```

### 2. Install

```sh
pnpm install
```

### 3. Create `src/lib/api.ts`

```ts
import { createPlatformApiClient } from "@repo/api";

export const api = createPlatformApiClient();
```

This is the only place `createPlatformApiClient` is called in your MFE.

### 4. Run through the Shell

Start the shell alongside your MFE:

```sh
pnpm dev --filter=shell --filter=performance
```

Open `http://localhost:3000/performance` — API calls will work because the shell proxies `/api/*` to the gateway.

---

## Usage

The flow is: **service defines the function → component calls it**.

Services wrap `api` calls and export typed functions. Components call those functions — they never touch `api` directly.

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

export const updateEvaluation = (id: number, data: { rating: number }) =>
  api.put<Evaluation>(`/performance/evaluations/${id}`, data);

export const deleteEvaluation = (id: number) =>
  api.delete(`/performance/evaluations/${id}`);
```

```ts
// src/components/EvaluationList.tsx
import { getEvaluations, createEvaluation } from "@/services/evaluations";

const evaluations = await getEvaluations();
const created = await createEvaluation({ employeeId: 1, rating: 4 });
```

### Cancellation

```ts
// src/services/evaluations.ts
export const getEvaluations = (signal?: AbortSignal) =>
  api.get<Evaluation[]>("/performance/evaluations", { signal });
```

```ts
// src/components/EvaluationList.tsx
const controller = new AbortController();
const evaluations = await getEvaluations(controller.signal);
controller.abort(); // cancels the request
```

### Skip auth header (e.g. login endpoint)

```ts
// src/services/auth.ts
export const login = (body: { email: string; password: string }) =>
  api.post("/identity/auth/login", body, { skipAuth: true });
```

---

## Error handling

```ts
// src/components/EvaluationList.tsx
import { ApiError } from "@repo/api";

try {
  const data = await api.get("/performance/evaluations");
} catch (err) {
  if (err instanceof ApiError) {
    console.error(err.status, err.errors, err.correlationId);
  } else if (err instanceof DOMException) {
    // request was cancelled via AbortController
  } else if (err instanceof TypeError) {
    // network failure — user is offline or DNS failed
  }
}
```

Always handle `TypeError`. When the user is offline the gateway never responds, so `ApiError` is never thrown.

---

## Service layer

Keep all API calls in `src/services/`. Components call services — never `api` directly.

```
src/
  lib/
    api.ts                    ← createPlatformApiClient() here only
  services/
    evaluations.ts            ← typed wrappers around api.get / api.post etc.
  components/
    EvaluationList.tsx        ← imports from services, not from lib/api
```

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
import { getEvaluations } from "@/services/evaluations"; // ✓
import { api } from "@/lib/api"; // ✗ not in components
```

---

## API reference

### `createPlatformApiClient(config?)`

| Option     | Default                                      | Description             |
| ---------- | -------------------------------------------- | ----------------------- |
| `baseUrl`  | `NEXT_PUBLIC_API_BASE_URL` \|\| `"/api"`     | Prepended to every path |
| `getToken` | `() => localStorage.getItem("access_token")` | Called per-request      |

### `RequestOptions` (last arg of any method)

| Option        | Description                                        |
| ------------- | -------------------------------------------------- |
| `headers`     | Merged over `defaultHeaders` for this request only |
| `credentials` | Fetch credentials mode. Default: `"same-origin"`   |
| `signal`      | `AbortSignal` for cancellation                     |
| `skipAuth`    | Omit the `Authorization` header                    |

### `ApiError` properties

| Property        | Type             | Description                            |
| --------------- | ---------------- | -------------------------------------- |
| `status`        | `number`         | HTTP status code                       |
| `statusText`    | `string`         | HTTP status text                       |
| `errors`        | `string[]`       | Error messages from the backend        |
| `correlationId` | `string \| null` | Trace ID — include this in bug reports |
