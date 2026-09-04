// mini-app/src/helpers/__tests__/reviewsTabs.test.ts
//
// Unit-тесты чистой логики вкладок панели «Отзывы» профиля
// (helpers/reviewsTabs.ts): фильтрация по вкладкам Мои/О вас.
// Логика вынесена из компонента в чистую функцию именно ради этих тестов
// (без DOM — среда node, как во всех unit-тестах репо).
import { describe, expect, it } from "vitest";
import { REVIEW_STATUS } from "@edem/contracts";
import type { Review, User } from "@/types";
import { getReviewsForTab, REVIEW_TAB_OPTIONS, type ReviewTab } from "../reviewsTabs";

const AUTHOR: User = {
  id: "u-author",
  name: "Автор",
  avatar: "https://i.pravatar.cc/200?img=1",
  rating: 5,
  reviewsCount: 1,
  tripsCount: 1,
};

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r-1",
    author: AUTHOR,
    targetRole: "passenger",
    rating: 5,
    text: "Текст отзыва",
    status: REVIEW_STATUS.PUBLISHED,
    date: "1 сентября 2026",
    tripRoute: "Вологда → Череповец",
    ...overrides,
  };
}

describe("REVIEW_TAB_OPTIONS", () => {
  it("порядок вкладок: Мои, О вас", () => {
    expect(REVIEW_TAB_OPTIONS.map((option) => option.value)).toEqual([
      "mine",
      "about",
    ]);
    expect(REVIEW_TAB_OPTIONS.map((option) => option.label)).toEqual([
      "Мои",
      "О вас",
    ]);
  });
});

describe("getReviewsForTab: вкладка «Мои» (mine)", () => {
  it("возвращает все свои отзывы вместе: pending + published + rejected", () => {
    const myReviews = [
      makeReview({ id: "r-pending", status: REVIEW_STATUS.PENDING }),
      makeReview({ id: "r-published", status: REVIEW_STATUS.PUBLISHED }),
      makeReview({ id: "r-rejected", status: REVIEW_STATUS.REJECTED }),
    ];

    const result = getReviewsForTab(myReviews, [], "mine", "passenger");

    expect(result.map((review) => review.id)).toEqual([
      "r-pending",
      "r-published",
      "r-rejected",
    ]);
  });
});

describe("getReviewsForTab: вкладка «О вас» (about)", () => {
  it("фильтрует публичные отзывы по активной роли: passenger → о пассажире", () => {
    const about = [
      makeReview({ id: "r-as-passenger", targetRole: "passenger" }),
      makeReview({ id: "r-as-driver", targetRole: "driver" }),
    ];

    const result = getReviewsForTab([], about, "about", "passenger");

    expect(result.map((review) => review.id)).toEqual(["r-as-passenger"]);
  });

  it("фильтрует по роли driver: driver → о водителе", () => {
    const about = [
      makeReview({ id: "r-as-passenger", targetRole: "passenger" }),
      makeReview({ id: "r-as-driver", targetRole: "driver" }),
    ];

    const result = getReviewsForTab([], about, "about", "driver");

    expect(result.map((review) => review.id)).toEqual(["r-as-driver"]);
  });

  it("свои отзывы (myReviews) не попадают во вкладку «О вас»", () => {
    const myReviews = [makeReview({ id: "r-mine", targetRole: "driver" })];
    const about = [makeReview({ id: "r-about", targetRole: "driver" })];

    const result = getReviewsForTab(myReviews, about, "about", "driver");

    expect(result.map((review) => review.id)).toEqual(["r-about"]);
  });
});

describe("getReviewsForTab: общие свойства", () => {
  it("сохраняет серверный порядок (createdAt desc) для смешанных статусов", () => {
    const myReviews = [
      makeReview({ id: "r-new", status: REVIEW_STATUS.PENDING }),
      makeReview({ id: "r-mid", status: REVIEW_STATUS.PUBLISHED }),
      makeReview({ id: "r-old", status: REVIEW_STATUS.REJECTED }),
    ];

    const result = getReviewsForTab(myReviews, [], "mine", "passenger");

    expect(result.map((review) => review.id)).toEqual(["r-new", "r-mid", "r-old"]);
  });

  it("возвращает пустой массив на пустых входах (все вкладки)", () => {
    const tabs: ReviewTab[] = ["mine", "about"];

    for (const tab of tabs) {
      expect(getReviewsForTab([], [], tab, "passenger")).toEqual([]);
    }
  });

  it("не мутирует входные массивы", () => {
    const myReviews = [makeReview({ id: "r-1", status: REVIEW_STATUS.PENDING })];
    const about = [makeReview({ id: "r-2", targetRole: "driver" })];
    const mySnapshot = [...myReviews];
    const aboutSnapshot = [...about];

    getReviewsForTab(myReviews, about, "mine", "driver");
    getReviewsForTab(myReviews, about, "about", "driver");

    expect(myReviews).toEqual(mySnapshot);
    expect(about).toEqual(aboutSnapshot);
  });
});
