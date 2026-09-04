// mini-app/src/helpers/__tests__/feedbackModal.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Ленивый импорт модалки внутри openFeedbackModal резолвится в мок.
vi.mock("@/modals/FeedbackModal/FeedbackModal", () => ({
  FeedbackModal: () => null,
}));

import { openFeedbackModal } from "@/helpers/feedbackModal";

function createModalApiMock() {
  return { openCustomModalPage: vi.fn() };
}

describe("openFeedbackModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("передаёт initialSubject в additionalProps (экран бана)", async () => {
    // Arrange
    const modalApi = createModalApiMock();

    // Act
    await openFeedbackModal(
      modalApi as never,
      { initialSubject: "Обжалование блокировки" },
    );

    // Assert
    expect(modalApi.openCustomModalPage).toHaveBeenCalledTimes(1);
    const arg = modalApi.openCustomModalPage.mock.calls[0][0];
    expect(arg.additionalProps).toEqual({
      initialSubject: "Обжалование блокировки",
    });
    expect(arg.component).toBeDefined();
  });

  it("без options initialSubject остаётся undefined (SupportPanel — поведение не меняется)", async () => {
    // Arrange
    const modalApi = createModalApiMock();

    // Act
    await openFeedbackModal(modalApi as never);

    // Assert
    const arg = modalApi.openCustomModalPage.mock.calls[0][0];
    expect(arg.additionalProps).toEqual({ initialSubject: undefined });
  });
});
