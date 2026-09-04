import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const tripsRes = http.get(`${BASE_URL}/api/v1/trips?limit=20`);
  check(tripsRes, {
    "trips status 200": (r) => r.status === 200,
    "trips < 500ms": (r) => r.timings.duration < 500,
  });

  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health status 200": (r) => r.status === 200,
  });

  sleep(1);
}
