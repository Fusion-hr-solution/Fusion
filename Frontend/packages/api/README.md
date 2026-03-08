# @repo/api

Shared HTTP client for the EY HR Platform. Wraps `fetch`, adds auth headers, unwraps the backend envelope, and parses errors automatically.

---

## Setup

### 1. Add dependency + transpile

In your MFE's `package.json`:

```json
"dependencies": {
  "@repo/api": "workspace:*"
}
```

In `next.config.ts`:

```ts
transpilePackages: ["@repo/ui", /* …other packages… */ "@repo/api"],
```

Run `pnpm install`.

### 2. Create `src/lib/api.ts`

```ts
import { createPlatformApiClient } from "@repo/api";

export const api = createPlatformApiClient();
```

This is the only place you call `createPlatformApiClient`. Everything else imports `api` from here.

### 3. Run through the Shell

```sh
pnpm dev --filter=shell --filter=<your-mfe>
```

Open `http://localhost:3000/<your-mfe>`. The shell proxies `/api/*` to the gateway.

---

## File structure

```
src/
  lib/
    api.ts                 ← single createPlatformApiClient() call
  services/
    courses.ts             ← typed API functions
  components/
    CourseList.tsx          ← imports from services, never from lib/api
```

Components never import `api` directly. They call service functions.

---

## Services

```ts
// src/services/courses.ts
import { api } from "@/lib/api";
import type { Course } from "@/types";

export const getCourses = (signal?: AbortSignal) =>
  api.get<Course[]>("/training/courses", { signal });

export const getCourse = (id: string) =>
  api.get<Course>(`/training/courses/${id}`);

export const createCourse = (data: { title: string }) =>
  api.post<Course>("/training/courses", data);

export const deleteCourse = (id: string) =>
  api.delete(`/training/courses/${id}`);
```

### Skip auth (public endpoints)

```ts
export const login = (body: { email: string; password: string }) =>
  api.post("/identity/auth/login", body, { skipAuth: true });
```

---

## Client component (protected data)

Auth tokens live in `localStorage` → fetch protected data in client components.

```tsx
"use client";

import { useEffect, useState } from "react";
import { getCourses } from "@/services/courses";
import { ApiError } from "@repo/api";

export default function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    getCourses(controller.signal)
      .then(setCourses)
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(`${err.status}: ${err.errors.join(", ")}`);
        } else if (err instanceof TypeError) {
          setError("Network error — are you online?");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <ul>
      {courses.map((c) => (
        <li key={c.id}>{c.title}</li>
      ))}
    </ul>
  );
}
```

## Server component (public data only)

For SSR, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api` in `.env.local` so fetches reach the gateway directly (the shell proxy only works in the browser).

```tsx
// src/app/health/page.tsx  (no "use client")
import { api } from "@/lib/api";

export default async function HealthPage() {
  const health = await api.get<{ status: string }>("/identity/auth/health", {
    skipAuth: true,
  });

  return <p>Status: {health.status}</p>;
}
```

`skipAuth: true` prevents the auth header from being sent. The singleton's `getToken` returns `null` on the server anyway, so no `localStorage` access occurs.

> **Rule:** if you need auth, fetch in a client component.

---

## Error handling

```ts
import { ApiError } from "@repo/api";

try {
  await api.get("/something");
} catch (err) {
  if (err instanceof ApiError) {
    // err.status, err.errors, err.correlationId
  } else if (err instanceof TypeError) {
    // network failure
  } else if (err instanceof DOMException) {
    // request cancelled (AbortController)
  }
}
```

`ApiError.errors` contains the actual messages from the backend — both platform envelope errors and ASP.NET validation errors are flattened into `string[]`.

---

## API reference

### `createPlatformApiClient(config?)`

| Option     | Default                                      | Description                                   |
| ---------- | -------------------------------------------- | --------------------------------------------- |
| `baseUrl`  | `NEXT_PUBLIC_API_BASE_URL` \|\| `"/api"`     | Prepended to every path. Set env var for SSR. |
| `getToken` | `() => localStorage.getItem("access_token")` | Called per-request. Returns `null` on server. |

### `RequestOptions`

| Option        | Description                                      |
| ------------- | ------------------------------------------------ |
| `headers`     | Merged over defaults for this request only       |
| `credentials` | Fetch credentials mode. Default: `"same-origin"` |
| `signal`      | `AbortSignal` for cancellation                   |
| `skipAuth`    | Omit the `Authorization` header                  |

### `ApiError`

| Property        | Type             | Description               |
| --------------- | ---------------- | ------------------------- |
| `status`        | `number`         | HTTP status code          |
| `statusText`    | `string`         | HTTP status text          |
| `errors`        | `string[]`       | Messages from the backend |
| `correlationId` | `string \| null` | Trace ID for bug reports  |
