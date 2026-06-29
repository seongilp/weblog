/// <reference lib="webworker" />

/*
 * Generates synthetic but realistic web-server logs as a normalized CSV buffer.
 * Runs in its own worker so generating a million rows never blocks the UI.
 */

export interface SampleRequest {
  count: number;
}
export type SampleResponse =
  | { type: "progress"; ratio: number }
  | { type: "done"; buffer: Uint8Array; bytes: number; count: number }
  | { type: "error"; message: string };

const LEVELS: Array<[string, number]> = [
  ["INFO", 0.72],
  ["DEBUG", 0.12],
  ["WARN", 0.1],
  ["ERROR", 0.05],
  ["FATAL", 0.01],
];
const SERVICES = [
  "api-gateway",
  "auth-svc",
  "billing",
  "search",
  "checkout",
  "notifications",
  "user-svc",
  "inventory",
];
const METHODS = ["GET", "GET", "GET", "POST", "PUT", "DELETE", "PATCH"];
const PATHS = [
  "/api/v1/users",
  "/api/v1/orders",
  "/api/v1/products",
  "/api/v1/cart",
  "/api/v1/search",
  "/api/v1/checkout",
  "/api/v1/auth/login",
  "/api/v1/health",
  "/static/app.js",
  "/api/v1/recommendations",
];
const MESSAGES = [
  "request completed",
  "cache miss, fetching from origin",
  "rate limit threshold approaching",
  "upstream timeout, retrying",
  "connection pool exhausted",
  "validation failed for payload",
  "token refreshed successfully",
  "slow query detected",
];

// Deterministic PRNG so demo data is reproducible across reloads.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand: number): string {
  let acc = 0;
  for (const [level, w] of LEVELS) {
    acc += w;
    if (rand <= acc) return level;
  }
  return "INFO";
}

self.onmessage = (e: MessageEvent<SampleRequest>) => {
  try {
    const count = Math.max(1, e.data.count | 0);
    const rng = mulberry32(0x1234abcd);
    const parts: string[] = [
      "line_no,timestamp,level,service,method,path,status,latency_ms,message\n",
    ];
    // Walk backwards in time from "now" by ~25ms per line.
    const baseMs = 1_750_000_000_000; // fixed epoch for reproducibility
    const chunkFlush = 50_000;
    let buffer = "";

    for (let i = 0; i < count; i++) {
      const level = pickWeighted(rng());
      const service = SERVICES[(rng() * SERVICES.length) | 0];
      const method = METHODS[(rng() * METHODS.length) | 0];
      const path = PATHS[(rng() * PATHS.length) | 0];
      const status =
        level === "ERROR" || level === "FATAL"
          ? rng() < 0.5
            ? 500
            : 503
          : level === "WARN"
            ? rng() < 0.5
              ? 429
              : 404
            : rng() < 0.95
              ? 200
              : 301;
      const latency = Math.round(
        (level === "ERROR" ? 800 : 30) + rng() * (level === "ERROR" ? 4000 : 300),
      );
      const ts = new Date(baseMs + i * 25).toISOString();
      // Messages contain commas, so quote the field to keep the CSV valid.
      const msg = MESSAGES[(rng() * MESSAGES.length) | 0];
      buffer += `${i + 1},${ts},${level},${service},${method},${path},${status},${latency},"${msg}"\n`;

      if (i > 0 && i % chunkFlush === 0) {
        parts.push(buffer);
        buffer = "";
        (self as DedicatedWorkerGlobalScope).postMessage({
          type: "progress",
          ratio: i / count,
        } satisfies SampleResponse);
      }
    }
    if (buffer) parts.push(buffer);

    const bytes = new TextEncoder().encode(parts.join(""));
    (self as DedicatedWorkerGlobalScope).postMessage(
      { type: "done", buffer: bytes, bytes: bytes.byteLength, count } satisfies SampleResponse,
      [bytes.buffer],
    );
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    } satisfies SampleResponse);
  }
};
