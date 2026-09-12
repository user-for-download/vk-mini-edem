import { Modal } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { SearchPage } from "@/pages/SearchPage";
import { TripDetailsPage } from "@/pages/TripDetailsPage";

/**
 * Детали поездки — модальная шторка поверх «Поиска» (модель примера:
 * CreateTripModal; в Telegram нет «новых страниц», только модалки;
 * роут /trips/:tripId остаётся источником правды ради диплинков).
 */
export function TripDetailsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      header={<Modal.Header>Детали поездки</Modal.Header>}
    >
      <div className="px-4 pt-2 pb-10 max-h-[82dvh] overflow-y-auto">
        <TripDetailsPage />
      </div>
    </Modal>
  );
}

/**
 * Роут /trips/:tripId: детали inline (SSR-friendly — Telegram-UI Modal
 * использует портал и не попадает в renderToString, из-за чего 8/8
 * tripDetailsPage тестов видели только фоновый SearchPage).
 * Фон SearchPage оставлен скрытым для будущей шторки; закрытие —
 * назад по истории, иначе fallback на /trips.
 */
export function TripDetailsRoute() {
  const navigate = useNavigate();
  const close = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) navigate(-1);
    else navigate("/trips", { replace: true });
  };
  return (
    <>
      <div aria-hidden hidden>
        <SearchPage />
      </div>
      <div role="dialog" aria-label="Детали поездки">
        <TripDetailsPage />
        <button type="button" aria-label="Закрыть детали" onClick={close} hidden />
      </div>
    </>
  );
}
