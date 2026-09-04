// mini-app/src/helpers/feedbackModal.ts
import type { useModalApi } from "@/providers/ModalProvider";
import { loadModule } from "@/helpers/loadModule";

type ModalApi = ReturnType<typeof useModalApi>;

export interface OpenFeedbackModalOptions {
  /**
   * Предзаполненная тема обращения (экран бана: «Обжалование блокировки»).
   */
  initialSubject?: string;
}

/**
 * Открывает форму обратной связи (Профиль → Помощь и поддержка).
 * Модуль модалки подгружается лениво.
 */
export async function openFeedbackModal(
  modalApi: ModalApi,
  options?: OpenFeedbackModalOptions,
): Promise<void> {
  const module = await loadModule(
    () => import("@/modals/FeedbackModal/FeedbackModal"),
  );
  if (!module) return;
  const { FeedbackModal } = module;

  modalApi.openCustomModalPage({
    component: FeedbackModal,
    additionalProps: {
      initialSubject: options?.initialSubject,
    },
  });
}
