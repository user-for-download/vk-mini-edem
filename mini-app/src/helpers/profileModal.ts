// mini-app/src/helpers/profileModal.ts
import type { useModalApi } from "@/providers/ModalProvider";
import { loadModule } from "@/helpers/loadModule";

type ModalApi = ReturnType<typeof useModalApi>;

/**
 * Открывает карточку публичного профиля пользователя (водитель или пассажир):
 * GET /users/:id + отзывы GET /reviews/user/:userId.
 *
 * @param title Заголовок в состоянии загрузки, например «Профиль пассажира».
 */
export async function openUserProfileModal(
  modalApi: ModalApi,
  userId: string,
  title = "Профиль водителя"
): Promise<void> {
  if (!userId) return;

  const module = await loadModule(
    () => import("@/modals/DriverProfileModal/DriverProfileModal")
  );
  if (!module) return;
  const { DriverProfileModal } = module;

  modalApi.openCustomModalCard({
    component: DriverProfileModal,
    additionalProps: { driverId: userId, title },
  });
}
