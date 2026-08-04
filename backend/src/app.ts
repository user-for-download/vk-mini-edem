import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRouter } from "./auth/index.js";
import { tripsRouter } from "./trips/index.js";
import { bookingsRouter } from "./bookings/index.js";
import { reviewsRouter } from "./reviews/index.js";
import { usersRouter } from "./users/index.js";

export const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "edem-backend", time: new Date().toISOString() });
});

app.route("/api/auth", authRouter);
app.route("/api/trips", tripsRouter);
app.route("/api/bookings", bookingsRouter);
app.route("/api/reviews", reviewsRouter);
app.route("/api/users", usersRouter);
