// Stands in for the CANDIDATE's source (Next.js app-router page).
// "use client" is required by Next for useState — under Vitest it's just an inert directive.
"use client";

import { useState } from "react";

export default function Page() {
  const [count, setCount] = useState(0);
  return (
    <main>
      <h1>Counter</h1>
      <p data-testid="count">{count}</p>
      <button onClick={() => setCount((c) => Math.max(0, c - 1))} disabled={count === 0}>
        -
      </button>
      <button onClick={() => setCount(0)}>Reset</button>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </main>
  );
}
