// mini-app/src/helpers/feedbackDetailModal.ts
import type { useModalApi } from "@/providers/ModalProvider";
import { loadModule } from "@/helpers/loadModule";
import type { UserFeedbackDto } from "@edem/contracts";

type ModalApi = ReturnType<typeof useModalApi>;

/**
 * Открывает read-only просмотр обращения и ответа поддержки.
 * Модуль модалки подгружается лениво.
 */
export async function openFeedbackDetailModal(
  modalApi: ModalApi,
  feedback: UserFeedbackDto,
): Promise<void> {
  const module = await loadModule(
    () => import("@/modals/FeedbackDetailModal/FeedbackDetailModal"),
  );
  if (!module) return;
  const { FeedbackDetailModal } = module;

  modalApi.openCustomModalPage({
    component: FeedbackDetailModal,
    additionalProps: { feedback },
  });
}
