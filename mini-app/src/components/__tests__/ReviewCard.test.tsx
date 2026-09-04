// mini-app/src/components/__tests__/ReviewCard.test.tsx
//
// Рендер-тесты карточки отзыва на шаблоне SimpleCell без @testing-library/react
// (не установлен): используем react-dom/server renderToString (среда node,
// DOM не нужен). Компонент презентационный (без сторов/провайдеров) —
// достаточно передать валидный Review.
//
// Слоты SimpleCell (см. mini-app/src/components/ReviewCard.tsx):
// - children — имя автора + бейдж статуса (ContentBadge, только для непубличных);
// - before — Avatar 44 автора;
// - overTitle — НЕ используется;
// - extraSubtitle — «{tripRoute} · {date}»;
// - subtitle — текст комментария;
// - indicator — оценка числом + сердечко Icon24Favorite;
// - multiline — полный текст без ellipsis;
// - non-clickable — без onClick (нет role="button").
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { ReviewCard } from "@/components/ReviewCard";
import type { Review, User } from "@/types";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    name: "Илья Северов",
    avatar: "https://i.pravatar.cc/200?img=12",
    rating: 4.9,
    reviewsCount: 10,
    tripsCount: 20,
    ...overrides,
  };
}

// Длинный отзыв (порядка 150 символов — лимит REVIEW_TEXT_MAX_LENGTH):
// должен отрендериться целиком, без обрезки.
const FULL_TEXT =
  "Быстрая и аккуратная поездка: водитель приехал вовремя, машина чистая и тёплая, " +
  "по пути было комфортно, дорогу хорошо знает. Однозначно рекомендую.";

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r-1",
    author: makeUser(),
    targetRole: "driver",
    rating: 5,
    text: FULL_TEXT,
    // Публичные списки (ProfilePanel, DriverProfileModal) получают только
    // "published" — дефолтная фикстура соответствует этому сценарию.
    status: "published",
    date: "29 августа 2026 г.",
    tripRoute: "Москва → Тула",
    ...overrides,
  };
}

describe("ReviewCard — слоты SimpleCell", () => {
  it("рендерит имя автора как children и Avatar в before", () => {
    // Arrange — опубликованный отзыв с известным автором.
    const review = makeReview();

    // Act — SSR-рендер статичной ячейки.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — имя в children, аватар в before, кубиков нет.
    expect(html).toContain("vkuiSimpleCell__children");
    expect(html).toContain("Илья Северов");
    expect(html).toContain("vkuiSimpleCell__before");
    expect(html).toContain("vkuiAvatar");
    expect(html).not.toContain("dice");
  });

  it("рендерит маршрут·дату в extraSubtitle", () => {
    // Arrange — известный маршрут и дата.
    const review = makeReview();

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — формат «{tripRoute} · {date}» в extraSubtitle.
    expect(html).toContain("vkuiSimpleCell__extraSubtitle");
    expect(html).toContain("Москва → Тула · 29 августа 2026 г.");
  });

  it("рендерит текст отзыва в subtitle (multiline, без обрезки)", () => {
    // Arrange — длинный текст на ~150 символов.
    const review = makeReview();

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — весь текст в subtitle, multiline включает перенос строк.
    expect(html).toContain("vkuiSimpleCell__subtitle");
    expect(html).toContain(FULL_TEXT);
    expect(html).toContain("vkuiSimpleCell__mult");
  });

  it("рендерит оценку числом и сердечко в indicator", () => {
    // Arrange — оценка 5.
    const review = makeReview({ rating: 5 });

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — число в indicator + svg сердечка, кубиков нет.
    expect(html).toContain("vkuiSimpleCell__indicator");
    expect(html).toContain(">5<");
    expect(html).toContain("<svg");
    expect(html).not.toContain("dice");
  });

  it("отражает изменение оценки в indicator (без кубиков)", () => {
    // Arrange — та же фикстура с оценкой 3.
    const review = makeReview({ rating: 3 });

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — новое число на месте, старого нет, иконок-кубиков нет.
    expect(html).toContain("vkuiSimpleCell__indicator");
    expect(html).toContain(">3<");
    expect(html).not.toContain(">5<");
    expect(html).not.toContain("dice");
  });

  it("некликабельная: без role=button, chevron и after", () => {
    // Arrange — обычная опубликованная карточка.
    const review = makeReview();

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — нет onClick → нет кнопки, шеврона и after-блока.
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain("vkuiSimpleCell__chevronIcon");
    expect(html).not.toContain("vkuiSimpleCell__after");
  });
});

describe("ReviewCard — бейдж статуса в children", () => {
  it("pending: бейдж «На модерации», overTitle нет", () => {
    // Arrange — отзыв на модерации.
    const review = makeReview({ status: "pending" });

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — бейдж с нужной подписью рядом с именем, чужой нет, overTitle нет.
    expect(html).toContain("На модерации");
    expect(html).not.toContain("Отклонён");
    expect(html).not.toContain("vkuiSimpleCell__overTitle");
  });

  it("rejected: бейдж «Отклонён», overTitle нет", () => {
    // Arrange — отклонённый отзыв.
    const review = makeReview({ status: "rejected" });

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — бейдж с нужной подписью, чужой нет, overTitle нет.
    expect(html).toContain("Отклонён");
    expect(html).not.toContain("На модерации");
    expect(html).not.toContain("vkuiSimpleCell__overTitle");
  });

  it("published: бейджа и overTitle нет", () => {
    // Arrange — опубликованный отзыв.
    const review = makeReview({ status: "published" });

    // Act — SSR-рендер.
    const html = renderToString(<ReviewCard review={review} />);

    // Assert — подписей статуса, бейджа и overTitle-блока нет,
    // маршрут·дата в extraSubtitle при этом на месте.
    expect(html).not.toContain("vkuiSimpleCell__overTitle");
    expect(html).not.toContain("На модерации");
    expect(html).not.toContain("Отклонён");
    expect(html).toContain("vkuiSimpleCell__extraSubtitle");
    expect(html).toContain("Москва → Тула · 29 августа 2026 г.");
  });
});
