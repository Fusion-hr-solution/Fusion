# @repo/api

Shared HTTP client for the EY HR Platform. Wraps `fetch`, adds auth headers, unwraps the backend envelope, and parses errors automatically. Includes lightweight React hooks for client components.

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

export const api = createPlatformApiClient({
  // Optional: redirect to login on 401
  onAuthError: () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  },
});
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

### Query params

Use `params` to append query string parameters. `undefined` and `null` values are filtered out automatically.

```ts
export const searchCourses = (filters: {
  page: number;
  search?: string;
  category?: string;
}) =>
  api.get<Course[]>("/training/courses", {
    params: {
      page: filters.page,
      search: filters.search,   // omitted from URL if undefined
      category: filters.category,
    },
  });
// → GET /api/training/courses?page=1&search=react
```

### Skip auth (public endpoints)

```ts
export const login = (body: { email: string; password: string }) =>
  api.post("/identity/auth/login", body, { skipAuth: true });
```

### File upload (FormData)

Pass a `FormData` instance as the body. The client will **not** set `Content-Type` — the browser auto-sets `multipart/form-data` with the correct boundary.

```ts
export const uploadResume = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<{ url: string }>("/recruitment/resumes", form);
};
```

### File download (blob)

Use `responseType: "blob"` to receive binary data without envelope unwrapping.

```ts
export const downloadReport = (id: string) =>
  api.get<Blob>(`/reports/${id}/export`, { responseType: "blob" });
```

Then trigger a download in the browser:

```ts
const blob = await downloadReport("123");
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "report.pdf";
a.click();
URL.revokeObjectURL(url);
```

Other `responseType` values: `"text"`, `"arrayBuffer"`.

---

## React hooks (`@repo/api/react`)

Lightweight hooks that eliminate `useState`/`useEffect` boilerplate for data fetching. Import from the `/react` subpath:

```ts
import { useApiQuery, useApiMutation } from "@repo/api/react";
```

### `useApiQuery` — fetch data on mount

```tsx
"use client";

import { useApiQuery } from "@repo/api/react";
import { getCourses } from "@/services/courses";

export default function CourseList() {
  const { data: courses, error, isLoading, refetch } = useApiQuery(
    (signal) => getCourses(signal)
  );

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-red-500">{error.message}</p>;

  return (
    <>
      <button onClick={refetch}>Refresh</button>
      <ul>
        {courses?.map((c) => (
          <li key={c.id}>{c.title}</li>
        ))}
      </ul>
    </>
  );
}
```

**Options:**

| Option    | Type      | Default | Description                          |
| --------- | --------- | ------- | ------------------------------------ |
| `enabled` | `boolean` | `true`  | Set `false` to defer the fetch       |

**Returns:**

| Property    | Type                | Description                              |
| ----------- | ------------------- | ---------------------------------------- |
| `data`      | `T \| undefined`    | Resolved data                            |
| `error`     | `Error \| null`     | Error (includes `ApiError`)              |
| `isLoading` | `boolean`           | `true` while fetching                    |
| `refetch`   | `() => void`        | Re-run the query (e.g. after a mutation) |

Auto-aborts in-flight requests on unmount. Ignores stale responses.

### `useApiMutation` — trigger on user action

```tsx
"use client";

import { useApiMutation } from "@repo/api/react";
import { createCourse } from "@/services/courses";

export default function CreateCourseForm() {
  const { mutate, isLoading, error } = useApiMutation(createCourse, {
    onSuccess: (course) => console.log("Created:", course.id),
    onError: (err) => console.error(err),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const title = new FormData(e.currentTarget).get("title") as string;
        mutate({ title });
      }}
    >
      <input name="title" required />
      <button disabled={isLoading}>
        {isLoading ? "Creating…" : "Create"}
      </button>
      {error && <p className="text-red-500">{error.message}</p>}
    </form>
  );
}
```

**Options:**

| Option      | Type                     | Description                  |
| ----------- | ------------------------ | ---------------------------- |
| `onSuccess` | `(data: TData) => void`  | Called after a successful mutation |
| `onError`   | `(error: Error) => void` | Called on failure             |

**Returns:**

| Property       | Type                            | Description                       |
| -------------- | ------------------------------- | --------------------------------- |
| `mutate`       | `(args: TArgs) => void`        | Fire-and-forget                   |
| `mutateAsync`  | `(args: TArgs) => Promise<T>`  | Returns promise for `await`       |
| `data`         | `TData \| undefined`           | Last successful result            |
| `error`        | `Error \| null`                 | Last error                        |
| `isLoading`    | `boolean`                       | `true` while in flight            |
| `reset`        | `() => void`                    | Clear data, error, loading        |

### Future migration to TanStack Query

The hook signatures are designed to be compatible with TanStack Query. When the time comes:

1. Install `@tanstack/react-query`
2. Replace `useApiQuery(fn)` with `useQuery({ queryKey: [...], queryFn: fn })`
3. Replace `useApiMutation(fn)` with `useMutation({ mutationFn: fn })`

Return shapes are nearly identical — minimal code changes required.

---

## Client component (protected data — manual approach)

If you prefer manual control over the hooks, the pattern still works:

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

| Option        | Default                                      | Description                                   |
| ------------- | -------------------------------------------- | --------------------------------------------- |
| `baseUrl`     | `NEXT_PUBLIC_API_BASE_URL` \|\| `"/api"`     | Prepended to every path. Set env var for SSR. |
| `getToken`    | `() => localStorage.getItem("access_token")` | Called per-request. Returns `null` on server. |
| `onAuthError` | —                                            | Called on 401 before throwing. Use to redirect to login or clear tokens. |

### `RequestOptions`

| Option         | Description                                              |
| -------------- | -------------------------------------------------------- |
| `headers`      | Merged over defaults for this request only               |
| `credentials`  | Fetch credentials mode. Default: `"same-origin"`         |
| `signal`       | `AbortSignal` for cancellation                           |
| `skipAuth`     | Omit the `Authorization` header                          |
| `params`       | Query string params. `undefined`/`null` values filtered. |
| `responseType` | `"json"` (default), `"blob"`, `"text"`, `"arrayBuffer"` |

### `ApiError`

| Property        | Type             | Description               |
| --------------- | ---------------- | ------------------------- |
| `status`        | `number`         | HTTP status code          |
| `statusText`    | `string`         | HTTP status text          |
| `errors`        | `string[]`       | Messages from the backend |
| `correlationId` | `string \| null` | Trace ID for bug reports  |
