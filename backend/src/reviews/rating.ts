// backend/src/reviews/rating.ts
// Общий пересчёт рейтингового агрегата пользователя: используется при
// одобрении отзыва и при его удалении (admin/index.ts), чтобы логика не
// дублировалась.
import type { Prisma } from "../generated/prisma/client.js";

/**
 * Пересчитывает rating и reviewsCount пользователя по опубликованным
 * отзывам (status = "published"). Черновики (pending) и отклонённые
 * (rejected) отзывы в рейтинг и счётчик не входят.
 *
 * Вызывается внутри транзакции, меняющей отзывы, поэтому агрегат считается
 * по актуальным данным. Если опубликованных отзывов не осталось — rating
 * сбрасывается в 0 (дефолт нового пользователя), reviewsCount — в 0.
 */
export async function recomputeUserRating(
  tx: Prisma.TransactionClient,
  targetUserId: string
): Promise<void> {
  const aggregate = await tx.review.aggregate({
    where: {
      targetUserId,
      status: "published",
    },
    _avg: {
      rating: true,
    },
    _count: {
      _all: true,
    },
  });

  const avgRating = aggregate._avg.rating ?? 0;

  await tx.user.update({
    where: { id: targetUserId },
    data: {
      rating: Number(avgRating.toFixed(1)),
      reviewsCount: aggregate._count._all,
    },
  });
}
