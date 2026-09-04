// mini-app/src/onboarding/slides.ts
// Слайды онбординга для VKWebAppShowSlidesSheet.
//
// Изображения — временные заглушки-плейсхолдеры (832×555, соотношение 1,5:1,
// лимит VK — 500 КБ на файл). Для замены достаточно положить новые PNG/JPEG
// в assets/onboarding: импорт с ?inline отдаёт data:image/...;base64-строку,
// которую VK принимает в поле media.blob.
import type { ShowSlidesSheetRequest } from "@vkontakte/vk-bridge";

import slideSearch from "@/assets/onboarding/slide-search.png?inline";
import slideBooking from "@/assets/onboarding/slide-booking.png?inline";
import slideReview from "@/assets/onboarding/slide-review.png?inline";

export const ONBOARDING_SLIDES: ShowSlidesSheetRequest["slides"] = [
  {
    media: { type: "image", blob: slideSearch },
    title: "Находите поездки",
    subtitle:
      "Выбирайте маршрут, дату и время — и находите попутчиков или водителей рядом",
  },
  {
    media: { type: "image", blob: slideBooking },
    title: "Бронируйте места",
    subtitle:
      "Одно нажатие — и место забронировано. Водитель подтвердит заявку, и можно ехать",
  },
  {
    media: { type: "image", blob: slideReview },
    title: "Оставляйте отзывы",
    subtitle:
      "Оценивайте поездки после завершения — так сообщество становится безопаснее",
  },
];
