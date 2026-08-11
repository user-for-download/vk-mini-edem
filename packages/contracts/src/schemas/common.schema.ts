import { z } from "zod";

/**
 * Cursor-based pagination (используется в /reviews/user и /bookings/trip).
 * nextCursor = ID последнего элемента страницы (для cursor + skip: 1),
 * null означает конец списка.
 */
export const cursorPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number(),
});

export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
