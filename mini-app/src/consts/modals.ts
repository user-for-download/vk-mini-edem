// Детали поездки и бронирование места — теперь полноценные страницы (см. src/panels/TripDetailsPanel),
// а не модалки, поэтому здесь остались только те сценарии, для которых модальное окно уместно:
// быстрая форма создания, короткая оценка поездки и карточка-превью профиля водителя.
export const MODAL_CREATE_TRIP = "modal-create-trip";
export const MODAL_CREATE_REVIEW = "modal-create-review";
export const MODAL_DRIVER_PROFILE = "modal-driver-profile";
export const MODAL_CAR_FORM = "modal-car-form";
export const MODAL_EDIT_PROFILE = "modal-edit-profile";

/**
 * Модалка выбора поездки, о которой пользователь хочет оставить отзыв.
 */
export const MODAL_SELECT_REVIEW_TRIP = "modal-select-review-trip";
