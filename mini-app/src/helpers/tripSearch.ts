export function filterTripsForUser<T extends { driver: { id: string } }>(
  trips: T[],
  currentUserId?: string
): T[] {
  return trips.filter((trip) => trip.driver.id !== currentUserId);
}

export function shouldFetchMoreTrips(
  visibleTripsCount: number,
  hasNextPage: boolean,
  isFetchingNextPage: boolean
): boolean {
  return visibleTripsCount === 0 && hasNextPage && !isFetchingNextPage;
}
