import type { FC } from "react";
import { ModalRoot } from "@vkontakte/vkui";
import {
  MODAL_CREATE_REVIEW,
  MODAL_CREATE_TRIP,
  MODAL_DRIVER_PROFILE,
  MODAL_SELECT_REVIEW_TRIP,
} from "@/consts/modals";
import type { Trip, User } from "@/types";
import { CreateTripModal } from "@/modals/CreateTripModal/CreateTripModal";
import { CreateReviewModal } from "@/modals/CreateReviewModal/CreateReviewModal";
import { DriverProfileModal } from "@/modals/DriverProfileModal/DriverProfileModal";
import { SelectReviewTripModal } from "@/modals/SelectReviewTripModal/SelectReviewTripModal";

export interface AppModalRootProps {
  activeModal: string | null;
  reviewTrip: Trip | null;
  activeDriver: User | null;
  onClose: () => void;

  /**
   * Вызывается после успешного создания поездки.
   * Используется, чтобы переключить роль на driver и открыть /trips/my.
   */
  onTripCreated?: () => void;

  /**
   * Вызывается, когда пользователь выбрал поездку для отзыва.
   */
  onSelectReviewTrip?: (trip: Trip) => void;
}

/**
 * Единая точка сборки модалок приложения — переключаются по activeModal, как того требует VKUI.
 * Детали поездки и бронирование места сюда не входят: это полноценные страницы
 * (см. src/panels/TripDetailsPanel), а не модальные окна.
 */
export const AppModalRoot: FC<AppModalRootProps> = ({
  activeModal,
  reviewTrip,
  activeDriver,
  onClose,
  onTripCreated,
  onSelectReviewTrip,
}) => {
  return (
    <ModalRoot activeModal={activeModal} onClose={onClose}>
      <SelectReviewTripModal
        id={MODAL_SELECT_REVIEW_TRIP}
        onClose={onClose}
        onSelectTrip={onSelectReviewTrip ?? (() => {})}
      />
      <CreateTripModal
        id={MODAL_CREATE_TRIP}
        onClose={onClose}
        onTripCreated={onTripCreated}
      />
      <CreateReviewModal id={MODAL_CREATE_REVIEW} trip={reviewTrip} onClose={onClose} />
      <DriverProfileModal id={MODAL_DRIVER_PROFILE} driver={activeDriver} onClose={onClose} />
    </ModalRoot>
  );
};
