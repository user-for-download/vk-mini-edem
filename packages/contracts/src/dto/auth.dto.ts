import { z } from "zod";
import { userSchema } from "../schemas/user.schema.js";

// ─── Auth ───────────────────────────────────────────────────────────────────

export const authRequestSchema = z.object({
  vkUserId: z.number().int().positive(),
  sign: z.string().min(1),
  ts: z.number().int().positive(),
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
