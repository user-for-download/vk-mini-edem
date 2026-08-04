import { type FC, lazy, Suspense } from "react";
import { ModalRoot } from "@vkontakte/vkui";
import {
  MODAL_CAR_FORM,
  MODAL_CREATE_REVIEW,
  MODAL_CREATE_TRIP,
  MODAL_DRIVER_PROFILE,
  MODAL_EDIT_PROFILE,
  MODAL_SELECT_REVIEW_TRIP,
  MODAL_EDIT_TRIP,
} from "@/consts/modals";
import type { Trip } from "@/types";
import { useModalStore } from "@/store/useModalStore";

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
const EditTripModal = lazy(() =>
  import("@/modals/EditTripModal").then((m) => ({
    default: m.EditTripModal,
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
  const editTrip = useModalStore((state) => state.editTrip);
  const setEditTrip = useModalStore((state) => state.setEditTrip);

  const handleClose = () => {
    if (activeModal === MODAL_EDIT_TRIP) {
      setEditTrip(null);
    }
    onClose();
  };

  return (
    <Suspense fallback={null}>
      <ModalRoot activeModal={activeModal} onClose={handleClose}>
        <SelectReviewTripModal
          id={MODAL_SELECT_REVIEW_TRIP}
          onClose={handleClose}
          onSelectTrip={onSelectReviewTrip ?? (() => {})}
        />
        <CreateTripModal
          id={MODAL_CREATE_TRIP}
          onClose={handleClose}
          onTripCreated={onTripCreated}
        />
        {editTrip && (
          <EditTripModal
            id={MODAL_EDIT_TRIP}
            trip={editTrip}
            onClose={handleClose}
          />
        )}
        <CreateReviewModal
          id={MODAL_CREATE_REVIEW}
          trip={reviewTrip}
          onClose={handleClose}
        />
        <DriverProfileModal
          id={MODAL_DRIVER_PROFILE}
          driverId={driverId}
          onClose={handleClose}
        />
        <CarFormModal id={MODAL_CAR_FORM} onClose={handleClose} />
        <EditProfileModal id={MODAL_EDIT_PROFILE} onClose={handleClose} />
      </ModalRoot>
    </Suspense>
  );
};
