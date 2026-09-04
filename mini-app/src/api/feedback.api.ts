import { apiClient } from "./client";
import {
  createFeedbackResponseSchema,
  userFeedbackDtoSchema,
} from "@edem/contracts";
import type {
  CreateFeedbackDto,
  CreateFeedbackResponse,
  FeedbackAppealDto,
  UserFeedbackDto,
} from "@edem/contracts";
import { z } from "zod";

const userFeedbackListSchema = z.array(userFeedbackDtoSchema);

export const feedbackApi = {
  /**
   * Отправка обращения в поддержку (Профиль → Помощь и поддержка).
   */
  create: (data: CreateFeedbackDto): Promise<CreateFeedbackResponse> => {
    return apiClient.request<CreateFeedbackResponse>(
      "/feedback",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      createFeedbackResponseSchema,
    );
  },

  /**
   * Апелляция забаненного пользователя (экран бана → Обратная связь).
   * Публичный эндпоинт: у забаненного нет токена, личность подтверждается
   * VK-подписью launch-параметров (searchParams) на бэкенде. apiClient
   * добавляет Authorization только при наличии токена — здесь его нет.
   */
  appeal: (data: FeedbackAppealDto): Promise<CreateFeedbackResponse> => {
    return apiClient.request<CreateFeedbackResponse>(
      "/feedback/appeal",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      createFeedbackResponseSchema,
    );
  },

  /**
   * Список СВОИХ обращений в поддержку с ответами админа
   * (Профиль → Помощь и поддержка → «Мои обращения»). Авторизация
   * обязательна (requireUser на бэкенде).
   */
  listMine: (signal?: AbortSignal): Promise<UserFeedbackDto[]> => {
    return apiClient.request<UserFeedbackDto[]>(
      "/feedback",
      { signal },
      userFeedbackListSchema,
    );
  },
};
