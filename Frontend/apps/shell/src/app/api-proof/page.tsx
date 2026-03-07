"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@repo/api";
import { Button } from "@repo/ui";

interface HealthResult {
  status: string;
  error?: string;
}

export default function ApiProofPage() {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck() {
    setLoading(true);
    setResult(null);
    try {
      const data = await api.get<{ status: string }>("/identity/auth/health");
      setResult({ status: `OK — ${JSON.stringify(data)}` });
    } catch (err) {
      if (err instanceof ApiError) {
        setResult({
          status: "API Error",
          error: `${err.status} ${err.statusText}: ${err.errors.join(", ")} (correlationId: ${err.correlationId})`,
        });
      } else if (err instanceof TypeError) {
        setResult({ status: "Network Error", error: err.message });
      } else {
        setResult({ status: "Unknown Error", error: String(err) });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">API Client Proof</h1>
      <p className="text-muted-foreground mb-6">
        Click the button to send a test request through the API client to the
        gateway.
      </p>
      <Button onClick={handleCheck} disabled={loading}>
        {loading ? "Checking…" : "Test API Connection"}
      </Button>
      {result && (
        <pre className="mt-6 p-4 rounded border bg-muted text-sm whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
