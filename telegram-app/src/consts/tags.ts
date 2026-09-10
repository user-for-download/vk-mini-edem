// telegram-app/src/consts/tags.ts
// Обязано совпадать с tripTagSchema
// в @edem/contracts (там же — MAX_SEATS и остальные границы).
import type { TripTag } from "@edem/contracts";

export const TRIP_TAGS: TripTag[] = [
  "Можно с животными",
  "Можно курить",
  "Есть багаж",
  "Только девушки",
  "Тихая поездка",
  "С остановками",
  "Не курить",
  "Можно с детьми",
  "Разговорчивый",
];
