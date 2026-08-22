import { z } from "zod";
import { userSchema } from "../schemas/user.schema.js";

// ─── Auth ───────────────────────────────────────────────────────────────────

// Единственный поддерживаемый формат — полный searchParams из launch-параметров
// VK. Отдельные поля (vkUserId/sign/ts) намеренно НЕ входят в контракт: подпись
// VK считается по всем launch-параметрам, которых в payload нет, поэтому
// реконструкция по отдельным полям невозможна (backend отвечает 400/401).
export const authRequestSchema = z.object({
  searchParams: z.string().min(1).max(4096),
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
