// The preset tooling's only way to Fusion: every call goes through the gateway, as the person who acts, and past steps
// carry X-Demo-Clock (Development only, performance-demo-clock). The first refusal stops the build. The gateway, not the
// shell's /api route: that route forwards everything to the gateway unchanged, but the Next dev server in front of it
// takes ~1 s per call and resets connections under load (measured 2026-10-22: 33–58 ms at the gateway, 0.9–1 s at :3000).
// Sign-in still goes through the shell (api.cjs), once per person per 45 minutes.
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const helper = require("../../../../.agents/skills/fusion-dev/scripts/api.cjs");
export const { MAILPIT, PASSWORD } = helper;
export const BASE = process.env.FUSION_GATEWAY ?? "http://localhost:5000";

/** Throws with the call and the API's own error, so a refused step is never silent. */
export class Refused extends Error {
  constructor(method, route, status, json) {
    const code = json?.details?.code ?? "";
    const message = json?.errors?.[0] ?? (typeof json === "string" ? json.slice(0, 300) : JSON.stringify(json)?.slice(0, 600));
    super(`${method} ${route} → ${status} ${code} ${message}`.trim());
    this.status = status;
    this.code = code;
    this.json = json;
  }
}

// The simulated moment for the steps being run, or null for real time. Set by the timeline, read by every call;
// steps run side by side each carry their own moment (`run`).
let simulated = null;
const scoped = new AsyncLocalStorage();
export const clock = {
  set(instant) { simulated = instant; },
  get() { return scoped.getStore() ?? simulated; },
  run(instant, fn) { return scoped.run(instant, fn); },
};

/** 09:00 UTC (or the given hour) on a day `offset` days from `date`, as an ISO instant. */
export function at(date, offset = 0, hour = 9, minute = 0) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offset, hour, minute));
  return d.toISOString();
}

export function day(date, offset = 0) {
  return at(date, offset).slice(0, 10);
}

export async function send(token, method, route, body, { allow = [] } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Only past moments: the API refuses a clock later than its own now, and today's steps run on real time.
  const instant = clock.get();
  if (instant && new Date(instant).getTime() < Date.now() - 60_000) headers["X-Demo-Clock"] = instant;
  // A dropped connection or a gateway blip (the stack restarting a service) is retried; the API's own refusals are not.
  let response;
  for (let attempt = 1; ; attempt++) {
    try {
      response = await fetch(`${BASE}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (![502, 503, 504].includes(response.status) || attempt === 6) break;
    } catch (error) {
      if (attempt === 6) throw error;
    }
    await sleep(2000 * attempt);
  }
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (response.status >= 400 && !allow.includes(response.status)) throw new Refused(method, route, response.status, json);
  return { status: response.status, json, data: json?.data ?? json, headers: response.headers };
}

/** One signed-in person. Re-signs in before the hour-long access token runs out. */
export class Session {
  constructor(email) { this.email = email; this.token = null; this.issued = 0; }

  async auth() {
    if (!this.token || Date.now() - this.issued > 45 * 60_000) {
      this.token = await helper.login(this.email);
      this.issued = Date.now();
    }
    return this.token;
  }

  async call(method, route, body, options) {
    try { return (await send(await this.auth(), method, route, body, options)).data; }
    catch (error) {
      // Access changes (linking, a new profile) revoke the session's authority revision: sign in again, once.
      if (!(error instanceof Refused) || error.status !== 401) throw error;
      this.token = null;
      return (await send(await this.auth(), method, route, body, options)).data;
    }
  }
  get(route, options) { return this.call("GET", route, undefined, options); }
  post(route, body = {}, options) { return this.call("POST", route, body, options); }
  put(route, body = {}, options) { return this.call("PUT", route, body, options); }
}

const sessions = new Map();
export function as(email) {
  if (!sessions.has(email)) sessions.set(email, new Session(email));
  return sessions.get(email);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const inviteToken = helper.inviteToken;
