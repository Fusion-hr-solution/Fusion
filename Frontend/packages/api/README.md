# @repo/api

Shared HTTP client plus two React integration paths for the EY HR Platform.

---

## Quick start

### 1. Install

```json
// your-mfe/package.json
"dependencies": {
  "@repo/api": "workspace:*"
}
```

```ts
// next.config.ts
transpilePackages: ["@repo/ui", /* …other packages… */ "@repo/api"],
```

```sh
pnpm install
```

### 2. Create `src/lib/api.ts`

```ts
import { createPlatformApiClient } from "@repo/api";

export const api = createPlatformApiClient();
```

One call, one file. Everything else imports `api` from here.

### 3. Write service functions

```ts
// src/services/courses.ts
import { api } from "@/lib/api";
import type { Course } from "@/types";

export const getCourses = () => api.get<Course[]>("/training/courses");

export const getCourse = (id: string) =>
  api.get<Course>(`/training/courses/${id}`);

export const createCourse = (data: { title: string }) =>
  api.post<Course>("/training/courses", data);

export const deleteCourse = (id: string) =>
  api.delete(`/training/courses/${id}`);
```

### 4. Use in components

```tsx
"use client";

import { useApiQuery } from "@repo/api/react";
import { getCourses } from "@/services/courses";

export default function CourseList() {
  const { data: courses, error, isLoading, refetch } = useApiQuery(getCourses);

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

### 5. Run through the Shell

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

## Services cookbook

### Query params

```ts
export const searchCourses = (filters: {
  page: number;
  search?: string;
  category?: string;
}) =>
  api.get<Course[]>("/training/courses", {
    params: {
      page: filters.page,
      search: filters.search, // omitted from URL if undefined
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

Pass a `FormData` instance as the body. The client skips `Content-Type` — the browser sets `multipart/form-data` with the correct boundary.

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

Other `responseType` values: `"text"`, `"arrayBuffer"`.

---

## React hooks (`@repo/api/react`)

This is the legacy lightweight path. It remains supported for existing MFEs and for simple local-state fetching, but it does not provide a shared cache or query invalidation.

Lightweight hooks that eliminate `useState`/`useEffect` boilerplate. Import from the `/react` subpath:

```ts
import { useApiQuery, useApiMutation } from "@repo/api/react";
```

### `useApiQuery` — fetch data on mount

```tsx
"use client";

import { useApiQuery } from "@repo/api/react";
import { getCourses } from "@/services/courses";

export default function CourseList() {
  const { data: courses, error, isLoading, refetch } = useApiQuery(getCourses);

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

| Option    | Type      | Default | Description                    |
| --------- | --------- | ------- | ------------------------------ |
| `enabled` | `boolean` | `true`  | Set `false` to defer the fetch |

| Returns     | Type             | Description                              |
| ----------- | ---------------- | ---------------------------------------- |
| `data`      | `T \| undefined` | Resolved data                            |
| `error`     | `Error \| null`  | Error (includes `ApiError`)              |
| `isLoading` | `boolean`        | `true` while fetching                    |
| `refetch`   | `() => void`     | Re-run the query (e.g. after a mutation) |

Auto-aborts in-flight requests on unmount. Ignores stale responses.

### `useApiMutation` — trigger on user action

```tsx
"use client";

import { useApiMutation } from "@repo/api/react";
import { createCourse } from "@/services/courses";

export default function CreateCourseForm() {
  const { mutate, isLoading, error } = useApiMutation(createCourse, {
    onSuccess: (course) => console.log("Created:", course.id),
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
      <button disabled={isLoading}>{isLoading ? "Creating…" : "Create"}</button>
      {error && <p className="text-red-500">{error.message}</p>}
    </form>
  );
}
```

| Option      | Type                     | Description                        |
| ----------- | ------------------------ | ---------------------------------- |
| `onSuccess` | `(data: TData) => void`  | Called after a successful mutation |
| `onError`   | `(error: Error) => void` | Called on failure                  |

| Returns       | Type                          | Description                 |
| ------------- | ----------------------------- | --------------------------- |
| `mutate`      | `(args: TArgs) => void`       | Fire-and-forget             |
| `mutateAsync` | `(args: TArgs) => Promise<T>` | Returns promise for `await` |
| `data`        | `TData \| undefined`          | Last successful result      |
| `error`       | `Error \| null`               | Last error                  |
| `isLoading`   | `boolean`                     | `true` while in flight      |
| `reset`       | `() => void`                  | Clear data, error, loading  |

## TanStack query integration (`@repo/api/query`)

This is the recommended path for apps that need shared cache, keyed invalidation, or more advanced data-fetching behavior.

Current rollout status:

- Core is the first adopter of this integration.
- `@repo/api/react` stays stable for existing MFEs.
- Other MFEs can migrate incrementally with no flag day.

### 1. Wrap the app with the provider

```tsx
import { ApiQueryProvider } from "@repo/api/query";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ApiQueryProvider>{children}</ApiQueryProvider>;
}
```

### 2. Define stable query keys

```ts
const courseQueryKeys = {
  all: () => ["courses"] as const,
  detail: (id: string) => ["courses", "detail", id] as const,
};
```

### 3. Fetch with keyed queries

```tsx
"use client";

import { useApiQuery } from "@repo/api/query";
import { getCourses } from "@/services/courses";

export default function CourseList() {
  const {
    data: courses,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useApiQuery(courseQueryKeys.all(), getCourses);

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-red-500">{error.message}</p>;

  return (
    <>
      <button onClick={() => void refetch()} disabled={isFetching}>
        {isFetching ? "Refreshing…" : "Refresh"}
      </button>
      <ul>
        {courses?.map((c) => (
          <li key={c.id}>{c.title}</li>
        ))}
      </ul>
    </>
  );
}
```

### 4. Invalidate related data after mutations

```tsx
"use client";

import { useApiMutation } from "@repo/api/query";
import { createCourse } from "@/services/courses";

export function CreateCourseForm() {
  const { mutate, isLoading } = useApiMutation(createCourse, {
    invalidateQueries: [{ queryKey: courseQueryKeys.all() }],
  });

  return (
    <button
      onClick={() => mutate({ title: "New course" })}
      disabled={isLoading}
    >
      {isLoading ? "Creating…" : "Create"}
    </button>
  );
}
```

### Migration guidance

1. Keep existing code on `@repo/api/react` unless you need shared cache or invalidation.
2. New work should prefer `@repo/api/query` when the screen has related queries and mutations.
3. Migrate one feature area at a time by introducing query keys close to the API surface.
4. Preserve service functions and transport setup; the query layer should sit above the existing client rather than replacing it.

---

## Error handling

By default, failed requests throw `ApiError`. Callers decide what to do:

```ts
import { ApiError } from "@repo/api";

try {
  await api.get("/something");
} catch (err) {
  if (err instanceof ApiError) {
    // err.status, err.errors, err.correlationId
  } else if (err instanceof TypeError) {
    // network failure
  }
}
```

`ApiError.errors` contains messages from the backend — both platform envelope errors and ASP.NET validation errors are flattened into `string[]`.

### Optional: cancellation

Service functions can accept an `AbortSignal` for cancellation:

```ts
export const getCourses = (signal?: AbortSignal) =>
  api.get<Course[]>("/training/courses", { signal });
```

`useApiQuery` handles abort on unmount automatically — you only need this for manual `useEffect` patterns or long-running requests you want to cancel explicitly.

### Optional: `onAuthError` callback

By default a 401 just throws `ApiError` and the calling component handles it. If you want a **global** side-effect (e.g. clear tokens, show a toast), you can pass `onAuthError` when creating the client:

```ts
// src/lib/api.ts
export const api = createPlatformApiClient({
  onAuthError: (err) => {
    localStorage.removeItem("access_token");
    // show a toast, emit an event, etc.
  },
});
```

- Fires on **401 only** (not 403 or other errors)
- Fires **at most once** per client instance to prevent redirect loops
- The `ApiError` is still thrown after the callback — callers can catch it normally

---

## API reference

### `createPlatformApiClient(config?)`

| Option        | Default                                      | Description                                                    |
| ------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `baseUrl`     | `NEXT_PUBLIC_API_BASE_URL` \|\| `"/api"`     | Prepended to every path. Set env var for SSR.                  |
| `getToken`    | `() => localStorage.getItem("access_token")` | Called per-request. Returns `null` on server.                  |
| `onAuthError` | —                                            | Called once on the first 401. Error is still thrown to caller. |

### `RequestOptions`

| Option         | Description                                              |
| -------------- | -------------------------------------------------------- |
| `headers`      | Merged over defaults for this request only               |
| `credentials`  | Fetch credentials mode. Default: `"same-origin"`         |
| `signal`       | `AbortSignal` for cancellation                           |
| `skipAuth`     | Omit the `Authorization` header                          |
| `params`       | Query string params. `undefined`/`null` values filtered. |
| `responseType` | `"json"` (default), `"blob"`, `"text"`, `"arrayBuffer"`  |

### `ApiError`

| Property        | Type             | Description               |
| --------------- | ---------------- | ------------------------- |
| `status`        | `number`         | HTTP status code          |
| `statusText`    | `string`         | HTTP status text          |
| `errors`        | `string[]`       | Messages from the backend |
| `correlationId` | `string \| null` | Trace ID for bug reports  |

---

## SSR notes

For server-side rendering, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api` in `.env.local` so fetches reach the gateway directly (the shell proxy only works in the browser).

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
