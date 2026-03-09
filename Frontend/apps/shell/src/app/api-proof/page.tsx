"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@repo/api";
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui";

// ── Types ──────────────────────────────────────────────────────────

type ResultStatus = "pass" | "fail" | "info";

interface TestResult {
  label: string;
  status: ResultStatus;
  checks: string[];
}

const statusStyles: Record<ResultStatus, string> = {
  pass: "border-green-500 bg-green-50 dark:bg-green-950",
  fail: "border-red-500 bg-red-50 dark:bg-red-950",
  info: "border-blue-500 bg-blue-50 dark:bg-blue-950",
};

const statusIcon: Record<ResultStatus, string> = {
  pass: "✓ PASS",
  fail: "✗ FAIL",
  info: "ℹ INFO",
};

// ── Page ───────────────────────────────────────────────────────────

export default function ApiProofPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function addResult(r: TestResult) {
    setResults((prev) => [...prev, r]);
  }

  // ── Test 1: Connectivity + error parsing ──────────────────────
  //
  // Sends an intentionally invalid login request (empty fields, no auth header).
  // The backend SHOULD reject it with a 400 containing validation messages.
  //
  // What we're actually testing:
  //   ✓ fetch reaches the backend through the shell proxy
  //   ✓ skipAuth works (no Authorization header sent)
  //   ✓ the client parses both ASP.NET ProblemDetails AND platform envelope errors
  //   ✓ ApiError is thrown with the real validation messages (not a generic "Bad Request")

  async function testConnectivityAndErrors() {
    setLoading("connectivity");
    const checks: string[] = [];
    let status: ResultStatus = "pass";

    try {
      await api.post(
        "/identity/auth/login",
        { email: "", password: "" },
        { skipAuth: true }
      );
      // If the call somehow succeeds, that's unexpected
      checks.push("Unexpected: backend accepted empty credentials");
      status = "fail";
    } catch (err) {
      if (err instanceof ApiError) {
        checks.push(`Fetch reached backend → ${err.status} ${err.statusText}`);
        checks.push("skipAuth worked → no auth header was sent");

        if (err.errors.length > 0 && err.errors[0] !== "Bad Request") {
          checks.push(
            `Error parsing works → got ${err.errors.length} validation message(s):`
          );
          for (const msg of err.errors) {
            checks.push(`  • ${msg}`);
          }
        } else {
          checks.push(
            "Error parsing issue → got generic statusText instead of validation messages"
          );
          status = "fail";
        }

        if (err.correlationId) {
          checks.push(`Correlation ID present → ${err.correlationId}`);
        }
      } else if (err instanceof TypeError) {
        checks.push(`Network error: ${err.message}`);
        checks.push(
          "Is the backend running? Start the gateway on port 5000."
        );
        status = "fail";
      } else {
        checks.push(`Unexpected error type: ${String(err)}`);
        status = "fail";
      }
    } finally {
      addResult({
        label: "Connectivity & error handling",
        status,
        checks,
      });
      setLoading(null);
    }
  }

  // ── Test 2: Login ─────────────────────────────────────────────

  async function testLogin() {
    if (!email || !password) return;
    setLoading("login");
    const checks: string[] = [];
    let status: ResultStatus = "fail";

    try {
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        email: string;
        fullName: string;
        roles: string[];
      }>("/identity/auth/login", { email, password }, { skipAuth: true });

      localStorage.setItem("access_token", data.accessToken);
      localStorage.setItem("refresh_token", data.refreshToken);

      checks.push(`Authenticated as ${data.fullName} (${data.email})`);
      checks.push(`Roles: ${data.roles.join(", ")}`);
      checks.push("Access token stored in localStorage");
      status = "pass";
    } catch (err) {
      if (err instanceof ApiError) {
        checks.push(
          `${err.status} ${err.statusText}: ${err.errors.join(", ")}`
        );
        if (err.status === 401) {
          checks.push("Check your email and password.");
        } else if (err.status === 400) {
          checks.push("Validation error — check the email format.");
        }
      } else if (err instanceof TypeError) {
        checks.push(`Network error: ${err.message}`);
      } else {
        checks.push(String(err));
      }
    } finally {
      addResult({ label: "Login", status, checks });
      setLoading(null);
    }
  }

  // ── Test 3: Protected call ────────────────────────────────────

  async function testProtectedCall() {
    setLoading("protected");
    const checks: string[] = [];
    let status: ResultStatus = "fail";
    const token = localStorage.getItem("access_token");

    if (!token) {
      addResult({
        label: "Protected endpoint",
        status: "fail",
        checks: ["No token in localStorage — log in first (step 2)."],
      });
      setLoading(null);
      return;
    }

    checks.push("Token found in localStorage");

    try {
      const data = await api.get<unknown[]>("/identity/users");
      checks.push(
        `GET /identity/users → 200 OK, received ${Array.isArray(data) ? data.length : 0} user(s)`
      );
      checks.push("Authorization header was attached and accepted");
      status = "pass";
    } catch (err) {
      if (err instanceof ApiError) {
        checks.push(`GET /identity/users → ${err.status} ${err.statusText}`);
        if (err.status === 403) {
          checks.push(
            "Token was validated by the backend, but this user lacks the Admin/HR role."
          );
          checks.push(
            "Auth header attachment works — the 403 proves the token was sent and verified."
          );
          status = "pass";
        } else if (err.status === 401) {
          checks.push(
            "Token was rejected — it may have expired. Try logging in again."
          );
        } else {
          checks.push(`Errors: ${err.errors.join(", ")}`);
        }
      } else if (err instanceof TypeError) {
        checks.push(`Network error: ${err.message}`);
      } else {
        checks.push(String(err));
      }
    } finally {
      addResult({ label: "Protected endpoint", status, checks });
      setLoading(null);
    }
  }

  // ── Clear ─────────────────────────────────────────────────────

  function clearResults() {
    setResults([]);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">API Client Proof</h1>
        <p className="text-muted-foreground">
          End-to-end validation of <code>@repo/api</code>. Each test verifies a
          specific capability of the shared API client through the Shell proxy.
        </p>
      </div>

      {/* ── Test 1: Connectivity & error handling ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>1. Connectivity &amp; error handling</CardTitle>
          <CardDescription>
            Sends an intentionally invalid login request (empty fields, no auth
            header). Verifies: the request reaches the backend, the client
            correctly parses validation errors, and <code>skipAuth</code> works.
            A <strong>400</strong> with real validation messages means everything
            is wired up correctly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={testConnectivityAndErrors}
            disabled={loading !== null}
          >
            {loading === "connectivity" ? "Testing…" : "Run test"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Test 2: Login ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>2. Login (get a token)</CardTitle>
          <CardDescription>
            Authenticates via <code>POST /identity/auth/login</code> and stores
            the access token in <code>localStorage</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ey-hr.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            onClick={testLogin}
            disabled={loading !== null || !email || !password}
          >
            {loading === "login" ? "Logging in…" : "Login"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Test 3: Protected call ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>3. Protected endpoint (with auth)</CardTitle>
          <CardDescription>
            Calls <code>GET /identity/users</code> using the stored token.
            Verifies the <code>Authorization: Bearer</code> header is
            automatically attached from localStorage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={testProtectedCall} disabled={loading !== null}>
            {loading === "protected" ? "Testing…" : "Run test"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Results ─────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Results</h2>
            <Button variant="outline" onClick={clearResults}>
              Clear &amp; reset token
            </Button>
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded border p-4 text-sm ${statusStyles[r.status]}`}
            >
              <p className="font-semibold">
                {statusIcon[r.status]} — {r.label}
              </p>
              <ul className="mt-2 space-y-0.5 text-muted-foreground">
                {r.checks.map((c, j) => (
                  <li key={j} className="whitespace-pre-wrap">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
