// mini-app/src/consts/tags.ts
import type { TripTag } from "@edem/contracts";

/**
 * Полный список тегов, доступных для выбора при создании поездки.
 * Должен совпадать с tripTagSchema в @edem/contracts.
 */
export const TRIP_TAGS: TripTag[] = [
  "Можно с животными",
  "Можно курить",
  "Есть багаж",
  "Только девушки",
  "Тихая поездка",
  "С остановками",
];
