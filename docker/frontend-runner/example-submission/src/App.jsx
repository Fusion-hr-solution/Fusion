// Stands in for the CANDIDATE's source. A correct Counter solution: starts at 0, never goes
// below 0, and "-" is disabled at 0.
import { useState } from "react";

export default function App() {
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
