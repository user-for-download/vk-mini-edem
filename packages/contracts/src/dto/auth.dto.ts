import { z } from "zod";
import { userSchema } from "../schemas/user.schema.js";

// ─── Auth ───────────────────────────────────────────────────────────────────

export const authRequestSchema = z.object({
  searchParams: z.string().min(1).max(4096),
  vkUserId: z.number().int().positive().optional(),
  sign: z.string().optional(),
  ts: z.number().int().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  photo: z.string().optional(),
});

export type AuthRequest = z.infer<typeof authRequestSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  user: userSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
