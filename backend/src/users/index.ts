import { Hono } from "hono";
import { db } from "../db.js";
import {
  requireUser,
  type AuthEnv,
  type AuthUser,
} from "../auth/middleware.js";

function serializeUser(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    rating: user.rating,
    reviewsCount: user.reviewsCount,
    tripsCount: user.tripsCount,
    isVerified: user.isVerified,
    car: user.car
      ? {
          model: user.car.model,
          color: user.car.color,
          plate: user.car.plate,
        }
      : undefined,
    about: user.about || undefined,
  };
}

export const usersRouter = new Hono<AuthEnv>();

usersRouter.get("/me", requireUser, async (c) => {
  const user = c.get("user");
  return c.json(serializeUser(user));
});

usersRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const user = await db.user.findUnique({
    where: { id },
    include: { car: true },
  });

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json(serializeUser(user));
});

usersRouter.patch("/me", requireUser, async (c) => {
  const user = c.get("user");

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: unknown;
    about?: unknown;
  };

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : user.name;

  const about =
    body.about === null
      ? null
      : typeof body.about === "string"
        ? body.about
        : user.about;

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      name,
      about,
    },
    include: { car: true },
  });

  return c.json(serializeUser(updated));
});
