import type { Prisma } from "../generated/prisma/client.js";
import { db } from "../db.js";
import { createNotification } from "../services/notification.service.js";

type TripForMatching = Pick<Prisma.TripGetPayload<{}>, "id" | "driverId" | "fromCityId" | "toCityId" | "departureAt" | "durationMinutes">;

/** Notify each matching requester once per trip without creating a booking. */
export async function notifyMatchingRideRequests(trip: TripForMatching): Promise<void> {
  if (!trip.fromCityId || !trip.toCityId) return;

  const tripEnd = new Date(trip.departureAt.getTime() + trip.durationMinutes * 60_000);
  const requests = await db.rideRequest.findMany({
    where: {
      userId: { not: trip.driverId },
      fromCityId: trip.fromCityId,
      toCityId: trip.toCityId,
      status: "active",
      expiresAt: { gt: new Date() },
      earliestAt: { lte: tripEnd },
      latestAt: { gte: trip.departureAt },
    },
    select: { id: true, userId: true },
    take: 50,
  });

  for (const request of requests) {
    const type = "ride_request_match";
    const body = `Нашлась подходящая поездка для вашего запроса. Откройте поездку и отправьте заявку на бронирование. ID: ${trip.id}`;
    const duplicate = await db.notification.findFirst({
      where: { userId: request.userId, type, body: { contains: `ID: ${trip.id}` } },
      select: { id: true },
    });
    if (duplicate) continue;
    await createNotification(request.userId, type, "Подходящая поездка", body, `/trips/${trip.id}`);
  }
}
