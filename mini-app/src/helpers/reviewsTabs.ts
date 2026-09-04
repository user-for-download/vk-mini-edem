// mini-app/src/helpers/reviewsTabs.ts
//
// Чистая логика вкладок панели «Отзывы» профиля. Вынесена из компонента в
// чистую функцию: unit-тесты без DOM (см. __tests__/reviewsTabs.test.ts),
// компонент остаётся тонким (рендер + state).
import type { Review, Role } from "@/types";

/** Вкладки панели «Отзывы». Порядок совпадает с SegmentedControl. */
export type ReviewTab = "mine" | "about";

export const REVIEW_TAB_OPTIONS: ReadonlyArray<{
  label: string;
  value: ReviewTab;
}> = [
  { label: "Мои", value: "mine" },
  { label: "О вас", value: "about" },
];

/**
 * Отзывы для вкладки:
 * - `mine` — все мои отзывы без фильтра (pending + published + rejected),
 *   порядок сервера (createdAt desc) сохраняется. ReviewCard сам показывает
 *   подписи «На модерации» / «Отклонён» для непубликованных;
 * - `about` — публичные отзывы о пользователе (GET /reviews/user/:id
 *   отдаёт только published), отфильтрованные по активной роли профиля:
 *   пассажир → отзывы о пассажире, водитель → о водителе (то же поведение,
 *   что у прежней секции «отзывы о вас» в ProfilePanel).
 *
 * Порядок элементов сохраняется таким, как прислал сервер
 * (createdAt desc) — `date` в DTO — форматированная строка, сортировать
 * по ней нельзя.
 */
export function getReviewsForTab(
  myReviews: Review[],
  aboutReviews: Review[],
  tab: ReviewTab,
  role: Role
): Review[] {
  switch (tab) {
    case "mine":
      return myReviews;
    case "about":
      return aboutReviews.filter((review) => review.targetRole === role);
  }
}
