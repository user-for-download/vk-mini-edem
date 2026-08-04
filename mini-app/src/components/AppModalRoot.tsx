import { type FC, lazy, Suspense } from "react";
import { ModalRoot } from "@vkontakte/vkui";
import {
  MODAL_CAR_FORM,
  MODAL_CREATE_REVIEW,
  MODAL_CREATE_TRIP,
  MODAL_DRIVER_PROFILE,
  MODAL_EDIT_PROFILE,
  MODAL_SELECT_REVIEW_TRIP,
} from "@/consts/modals";
import type { Trip } from "@/types";

const SelectReviewTripModal = lazy(() =>
  import("@/modals/SelectReviewTripModal/SelectReviewTripModal").then((m) => ({
    default: m.SelectReviewTripModal,
  }))
);
const CreateTripModal = lazy(() =>
  import("@/modals/CreateTripModal/CreateTripModal").then((m) => ({
    default: m.CreateTripModal,
  }))
);
const CreateReviewModal = lazy(() =>
  import("@/modals/CreateReviewModal/CreateReviewModal").then((m) => ({
    default: m.CreateReviewModal,
  }))
);
const DriverProfileModal = lazy(() =>
  import("@/modals/DriverProfileModal/DriverProfileModal").then((m) => ({
    default: m.DriverProfileModal,
  }))
);
const CarFormModal = lazy(() =>
  import("@/modals/CarFormModal/CarFormModal").then((m) => ({
    default: m.CarFormModal,
  }))
);
const EditProfileModal = lazy(() =>
  import("@/modals/EditProfileModal/EditProfileModal").then((m) => ({
    default: m.EditProfileModal,
  }))
);

export interface AppModalRootProps {
  activeModal: string | null;
  reviewTrip: Trip | null;

  /**
   * Id водителя для DriverProfileModal.
   */
  driverId: string | null;

  onClose: () => void;

  /**
   * Вызывается после успешного создания поездки.
   */
  onTripCreated?: () => void;

  /**
   * Вызывается, когда пользователь выбрал поездку для отзыва.
   */
  onSelectReviewTrip?: (trip: Trip) => void;
}

/**
 * Единая точка сборки модалок приложения с ленивой загрузкой.
 */
export const AppModalRoot: FC<AppModalRootProps> = ({
  activeModal,
  reviewTrip,
  driverId,
  onClose,
  onTripCreated,
  onSelectReviewTrip,
}) => {
  return (
    <Suspense fallback={null}>
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
        <CreateReviewModal
          id={MODAL_CREATE_REVIEW}
          trip={reviewTrip}
          onClose={onClose}
        />
        <DriverProfileModal
          id={MODAL_DRIVER_PROFILE}
          driverId={driverId}
          onClose={onClose}
        />
        <CarFormModal id={MODAL_CAR_FORM} onClose={onClose} />
        <EditProfileModal id={MODAL_EDIT_PROFILE} onClose={onClose} />
      </ModalRoot>
    </Suspense>
  );
};
