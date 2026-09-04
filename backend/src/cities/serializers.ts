// backend/src/cities/serializers.ts
import type { City } from "../generated/prisma/client.js";
import type { CityDto, AdminCityDto } from "@edem/contracts";

/**
 * Публичное представление города: только id + name.
 * Никаких походов в БД — чистая функция.
 */
export const serializeCity = (city: Pick<City, "id" | "name">): CityDto => ({
  id: city.id,
  name: city.name,
});

/**
 * Админское представление: + счётчик поездок и временные метки.
 */
export const serializeAdminCity = (city: City): AdminCityDto => ({
  id: city.id,
  name: city.name,
  tripsCount: city.tripsCount,
  createdAt: city.createdAt.toISOString(),
  updatedAt: city.updatedAt.toISOString(),
});
