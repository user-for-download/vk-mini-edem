import { request } from "node:http";
import { request as requestHttps } from "node:https";

const target = new URL(process.env.LOAD_TEST_URL ?? "http://127.0.0.1:3011/health/live");
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 10);
const send = target.protocol === "https:" ? requestHttps : request;

let next = 0;
let failures = 0;
const durations = [];

async function worker() {
  while (next < requests) {
    next += 1;
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const req = send(target, (response) => {
        response.resume();
        response.on("end", () => {
          durations.push(performance.now() - startedAt);
          if (!response.statusCode || response.statusCode >= 400) failures += 1;
          resolve();
        });
      });
      req.on("error", () => {
        failures += 1;
        durations.push(performance.now() - startedAt);
        resolve();
      });
      req.end();
    });
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.floor(durations.length * value))] ?? 0;
const elapsed = performance.now() - startedAt;

console.log(
  `Load test: ${requests - failures}/${requests} successful, ${(requests / elapsed * 1000).toFixed(1)} req/s, p95 ${percentile(0.95).toFixed(1)} ms`,
);
if (failures > 0) process.exitCode = 1;
