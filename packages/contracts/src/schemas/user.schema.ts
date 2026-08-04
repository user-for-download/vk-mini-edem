import { z } from "zod";

// ─── Car ────────────────────────────────────────────────────────────────────
export const carSchema = z.object({
  model: z.string().min(1).max(50),
  color: z.string().min(1).max(30),
  plate: z.string().max(15),
});

export type Car = z.infer<typeof carSchema>;

// ─── User ───────────────────────────────────────────────────────────────────
export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  avatar: z.string().url(),
  rating: z.number().min(0).max(5),
  reviewsCount: z.number().int().min(0),
  tripsCount: z.number().int().min(0),
  isVerified: z.boolean().optional(),
  car: carSchema.optional(),
  about: z.string().max(500).optional(),
  createdAt: z.string().datetime().optional(),
});

export type User = z.infer<typeof userSchema>;

// ─── Role ───────────────────────────────────────────────────────────────────
export const roleSchema = z.enum(["passenger", "driver"]);

export type Role = z.infer<typeof roleSchema>;
