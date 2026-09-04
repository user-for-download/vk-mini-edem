import { describe, it, expect } from "vitest";
import {
  createFeedbackDtoSchema,
  createFeedbackResponseSchema,
  feedbackAppealDtoSchema,
  feedbackReplyBodySchema,
  userFeedbackDtoSchema,
  FEEDBACK_APPEAL_SEARCH_PARAMS_MAX_LENGTH,
  FEEDBACK_SUBJECT_MAX_LENGTH,
  FEEDBACK_TEXT_MAX_LENGTH,
} from "../src/dto/feedback.dto";
import {
  adminFeedbackDtoSchema,
  adminPaginatedFeedbackSchema,
} from "../src/dto/admin.dto";

describe("createFeedbackDtoSchema", () => {
  it("should parse valid feedback dto", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "Не приходит уведомление",
      text: "После подтверждения брони push-уведомление не появилось.",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty subject", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "",
      text: "Текст обращения",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty text", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "Тема",
      text: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only subject", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "   \t  ",
      text: "Текст обращения",
    });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only text", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "Тема",
      text: " \n\t ",
    });
    expect(result.success).toBe(false);
  });

  it("should trim subject and text on parse", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "  Тема  ",
      text: "  Текст обращения  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject).toBe("Тема");
      expect(result.data.text).toBe("Текст обращения");
    }
  });

  it("should reject subject longer than limit", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "x".repeat(FEEDBACK_SUBJECT_MAX_LENGTH + 1),
      text: "Текст обращения",
    });
    expect(result.success).toBe(false);
  });

  it("should accept subject at exact limit", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "x".repeat(FEEDBACK_SUBJECT_MAX_LENGTH),
      text: "Текст обращения",
    });
    expect(result.success).toBe(true);
  });

  it("should reject text longer than limit", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "Тема",
      text: "x".repeat(FEEDBACK_TEXT_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("should accept text at exact limit", () => {
    const result = createFeedbackDtoSchema.safeParse({
      subject: "Тема",
      text: "x".repeat(FEEDBACK_TEXT_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });
});

describe("createFeedbackResponseSchema", () => {
  it("should parse valid response", () => {
    const result = createFeedbackResponseSchema.safeParse({
      id: "fb-1",
      createdAt: "2026-08-26T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("should reject extra fields", () => {
    const result = createFeedbackResponseSchema.safeParse({
      id: "fb-1",
      createdAt: "2026-08-26T12:00:00.000Z",
      extra: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("feedbackAppealDtoSchema", () => {
  const validAppeal = {
    searchParams:
      "vk_user_id=123&vk_app_id=51271827&vk_is_app_user=1&sign=abc123",
    subject: "Обжалование блокировки",
    text: "Прошу пересмотреть решение о блокировке аккаунта.",
  };

  it("should parse valid appeal dto", () => {
    const result = feedbackAppealDtoSchema.safeParse(validAppeal);
    expect(result.success).toBe(true);
  });

  it("should reject missing searchParams", () => {
    const { searchParams: _searchParams, ...rest } = validAppeal;
    const result = feedbackAppealDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject missing subject", () => {
    const { subject: _subject, ...rest } = validAppeal;
    const result = feedbackAppealDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject missing text", () => {
    const { text: _text, ...rest } = validAppeal;
    const result = feedbackAppealDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject empty searchParams", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      searchParams: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only searchParams", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      searchParams: "   \t  ",
    });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only subject", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      subject: "   \t  ",
    });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only text", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      text: " \n\t ",
    });
    expect(result.success).toBe(false);
  });

  it("should trim all fields on parse", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      searchParams: `  ${validAppeal.searchParams}  `,
      subject: "  Обжалование блокировки  ",
      text: "  Прошу пересмотреть решение о блокировке аккаунта.  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.searchParams).toBe(validAppeal.searchParams);
      expect(result.data.subject).toBe("Обжалование блокировки");
      expect(result.data.text).toBe(
        "Прошу пересмотреть решение о блокировке аккаунта.",
      );
    }
  });

  it("should reject searchParams longer than limit", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      searchParams: "x".repeat(FEEDBACK_APPEAL_SEARCH_PARAMS_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("should accept searchParams at exact limit", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      searchParams: "x".repeat(FEEDBACK_APPEAL_SEARCH_PARAMS_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("should reject subject longer than limit", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      subject: "x".repeat(FEEDBACK_SUBJECT_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("should reject text longer than limit", () => {
    const result = feedbackAppealDtoSchema.safeParse({
      ...validAppeal,
      text: "x".repeat(FEEDBACK_TEXT_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("adminFeedbackDtoSchema", () => {
  const validFeedback = {
    id: "fb-1",
    subject: "Проблема с оплатой",
    text: "Не удалось оплатить поездку.",
    createdAt: "2026-08-26T12:00:00.000Z",
    userId: "u-1",
    userName: "Иван Петров",
    reply: null,
    repliedAt: null,
  };

  it("should parse valid admin feedback dto (no reply yet)", () => {
    const result = adminFeedbackDtoSchema.safeParse(validFeedback);
    expect(result.success).toBe(true);
  });

  it("should reject missing userName", () => {
    const { userName: _userName, ...rest } = validFeedback;
    const result = adminFeedbackDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject missing reply field", () => {
    const { reply: _reply, ...rest } = validFeedback;
    const result = adminFeedbackDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject missing repliedAt field", () => {
    const { repliedAt: _repliedAt, ...rest } = validFeedback;
    const result = adminFeedbackDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("adminPaginatedFeedbackSchema", () => {
  it("should parse paginated feedback list", () => {
    const result = adminPaginatedFeedbackSchema.safeParse({
      items: [
        {
          id: "fb-1",
          subject: "Тема",
          text: "Текст",
          createdAt: "2026-08-26T12:00:00.000Z",
          userId: "u-1",
          userName: "Иван",
          reply: null,
          repliedAt: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty items", () => {
    const result = adminPaginatedFeedbackSchema.safeParse({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });
});

describe("adminFeedbackDtoSchema — reply fields", () => {
  const baseFeedback = {
    id: "fb-1",
    subject: "Не приходит уведомление",
    text: "Push не появляется после подтверждения брони.",
    createdAt: "2026-08-30T12:00:00.000Z",
    userId: "u-1",
    userName: "Иван Петров",
  };

  it("should parse feedback without reply (still unanswered)", () => {
    const result = adminFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: null,
      repliedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("should parse feedback with reply and repliedAt", () => {
    const result = adminFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: "Спасибо, поправим в следующем релизе.",
      repliedAt: "2026-08-30T13:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("should reject feedback with non-string reply (null is the only nullable value)", () => {
    const result = adminFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: 123,
      repliedAt: null,
    });
    expect(result.success).toBe(false);
  });

  it("should reject feedback with non-datetime repliedAt", () => {
    const result = adminFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: "Ответ",
      repliedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("feedbackReplyBodySchema", () => {
  it("should parse valid reply", () => {
    const result = feedbackReplyBodySchema.safeParse({ reply: "Спасибо за обращение!" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reply).toBe("Спасибо за обращение!");
    }
  });

  it("should trim surrounding whitespace", () => {
    const result = feedbackReplyBodySchema.safeParse({ reply: "  Ответ  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reply).toBe("Ответ");
    }
  });

  it("should reject empty reply", () => {
    expect(feedbackReplyBodySchema.safeParse({ reply: "" }).success).toBe(false);
  });

  it("should reject whitespace-only reply (trim before min-length)", () => {
    expect(feedbackReplyBodySchema.safeParse({ reply: "   " }).success).toBe(false);
  });

  it("should accept reply of exactly 2000 characters (boundary)", () => {
    const result = feedbackReplyBodySchema.safeParse({ reply: "a".repeat(FEEDBACK_TEXT_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("should reject reply longer than 2000 characters", () => {
    const result = feedbackReplyBodySchema.safeParse({ reply: "a".repeat(FEEDBACK_TEXT_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it("should reject missing reply", () => {
    expect(feedbackReplyBodySchema.safeParse({}).success).toBe(false);
  });

  it("should reject non-string reply", () => {
    expect(feedbackReplyBodySchema.safeParse({ reply: 1 }).success).toBe(false);
  });

  it("should reject extra fields (strict)", () => {
    expect(
      feedbackReplyBodySchema.safeParse({ reply: "Ответ", extra: true }).success
    ).toBe(false);
  });
});

describe("userFeedbackDtoSchema", () => {
  const baseFeedback = {
    id: "fb-1",
    subject: "Вопрос",
    text: "Текст обращения",
    createdAt: "2026-08-30T12:00:00.000Z",
  };

  it("should parse feedback without reply (pending)", () => {
    const result = userFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: null,
      repliedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("should parse feedback with reply and repliedAt (answered)", () => {
    const result = userFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: "Ответ поддержки",
      repliedAt: "2026-08-30T13:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("should reject feedback with non-string reply", () => {
    const result = userFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: 1,
      repliedAt: null,
    });
    expect(result.success).toBe(false);
  });

  it("should reject feedback with extra fields (strict)", () => {
    const result = userFeedbackDtoSchema.safeParse({
      ...baseFeedback,
      reply: null,
      repliedAt: null,
      userId: "u-1",
    });
    expect(result.success).toBe(false);
  });
});
