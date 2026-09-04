// mini-app/src/queries/useFeedbackQuery.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFeedbackDto,
  CreateFeedbackResponse,
} from "@edem/contracts";
import { feedbackApi } from "../api/feedback.api";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";

/**
 * Отправка обращения: с токеном — обычный POST /feedback, без токена
 * (забаненный пользователь) — публичный POST /feedback/appeal, где личность
 * подтверждается VK-подписью launch-параметров из стора авторизации.
 * Экспортируется для прямого тестирования маршрутизации (без рендера).
 */
export async function submitFeedback(
  data: CreateFeedbackDto,
): Promise<CreateFeedbackResponse> {
  if (apiClient.getToken()) {
    return feedbackApi.create(data);
  }

  const { launchParams } = useAuthStore.getState();
  if (!launchParams) {
    throw new Error("Не удалось отправить обращение");
  }

  return feedbackApi.appeal({ searchParams: launchParams, ...data });
}

/**
 * Отправка обращения в поддержку. Кэшей для инвалидации нет —
 * обращения только пишутся, списки читает админ-панель.
 */
export function useCreateFeedbackMutation() {
  return useMutation({
    mutationFn: submitFeedback,
  });
}

/**
 * Список СВОИХ обращений (с ответами админа если есть). Запрос активен
 * только когда пользователь авторизован (есть токен) — иначе смысла нет
 * (апелляция забаненного отдельный flow, без токена, в эту выборку не попадает).
 */
export function useMyFeedbacksQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["feedback", "mine"] as const,
    queryFn: ({ signal }) => feedbackApi.listMine(signal),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Хелпер: после успешной отправки нового обращения — обновить кэш списка
 * «Мои обращения», чтобы пользователь сразу увидел новое письмо.
 */
export function useInvalidateMyFeedbacks() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["feedback", "mine"] });
  };
}
