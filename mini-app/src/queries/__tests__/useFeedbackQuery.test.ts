// mini-app/src/queries/__tests__/useFeedbackQuery.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/feedback.api", () => ({
  feedbackApi: {
    create: vi.fn(),
    appeal: vi.fn(),
  },
}));
vi.mock("@/api/client", () => ({
  apiClient: {
    getToken: vi.fn(),
  },
}));

import { apiClient } from "@/api/client";
import { feedbackApi } from "@/api/feedback.api";
import { useAuthStore } from "@/store/useAuthStore";
import { submitFeedback } from "@/queries/useFeedbackQuery";

const mockedCreate = vi.mocked(feedbackApi.create);
const mockedAppeal = vi.mocked(feedbackApi.appeal);
const mockedGetToken = vi.mocked(apiClient.getToken);

const validDto = { subject: "Обжалование блокировки", text: "Прошу пересмотреть" };
const launchParams = "vk_user_id=100001&sign=dev-sign&vk_app_id=0&vk_ts=1700000000&vk_platform=desktop_web";

function resetStore() {
  useAuthStore.setState({
    status: "idle",
    user: null,
    session: null,
    banReason: null,
    launchParams: null,
  });
  mockedCreate.mockReset();
  mockedAppeal.mockReset();
  mockedGetToken.mockReset();
}

describe("submitFeedback — маршрутизация", () => {
  beforeEach(resetStore);
  afterEach(() => vi.restoreAllMocks());

  it("с токеном → feedbackApi.create с dto, appeal не вызывается", async () => {
    // Arrange
    mockedGetToken.mockReturnValue("access-token-1");

    // Act
    await submitFeedback(validDto);

    // Assert
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(validDto);
    expect(mockedAppeal).not.toHaveBeenCalled();
  });

  it("без токена + launchParams в сторе → appeal с { searchParams, ...dto }, create не вызывается", async () => {
    // Arrange
    mockedGetToken.mockReturnValue(null);
    useAuthStore.setState({ launchParams });

    // Act
    await submitFeedback(validDto);

    // Assert
    expect(mockedAppeal).toHaveBeenCalledTimes(1);
    expect(mockedAppeal).toHaveBeenCalledWith({
      searchParams: launchParams,
      subject: validDto.subject,
      text: validDto.text,
    });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("без токена + launchParams null → отклоняется с понятной ошибкой, без вызова API", async () => {
    // Arrange
    mockedGetToken.mockReturnValue(null);
    useAuthStore.setState({ launchParams: null });

    // Act + Assert
    await expect(submitFeedback(validDto)).rejects.toThrow(
      "Не удалось отправить обращение",
    );
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedAppeal).not.toHaveBeenCalled();
  });

  it("с токеном launchParams в сторе игнорируется (используется create)", async () => {
    // Arrange
    mockedGetToken.mockReturnValue("access-token-1");
    useAuthStore.setState({ launchParams });

    // Act
    await submitFeedback(validDto);

    // Assert — appeal не дёргается, даже если launchParams есть
    expect(mockedCreate).toHaveBeenCalledWith(validDto);
    expect(mockedAppeal).not.toHaveBeenCalled();
  });
});
