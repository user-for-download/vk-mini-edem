import { useState, useCallback } from "react";

/**
 * Hook for managing PullToRefresh component state in VKUI.
 *
 * Provides explicit control over `isFetching` prop through local state,
 * avoiding dependency on TanStack Query lifecycle (isFetching/isLoading).
 *
 * @param refetch - Data refresh function (usually from TanStack Query)
 * @returns Object with `isRefreshing` (boolean) and `handleRefresh` (callback)
 *
 * @example
 * const { data, refetch } = useTripsQuery();
 * const { isRefreshing, handleRefresh } = usePullToRefresh(refetch);
 *
 * return (
 *   <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
 *     {content}
 *   </PullToRefresh>
 * );
 */
export function usePullToRefresh(
  refetch: () => Promise<unknown>
): {
  isRefreshing: boolean;
  handleRefresh: () => Promise<void>;
} {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      // Guarantee state reset even on network or API error
      setIsRefreshing(false);
    }
  }, [refetch]);

  return { isRefreshing, handleRefresh };
}

/**
 * Extended version for parallel refresh of multiple queries.
 * Each refetch is wrapped in try/catch so one failure doesn't block others.
 *
 * @param refetchers - Array of refetch functions
 * @returns Object with `isRefreshing` and `handleRefresh`
 *
 * @example
 * const { refetch: refetchTrips } = useTripsQuery();
 * const { refetch: refetchMyTrips } = useMyTripsQuery();
 * const { refetch: refetchBookings } = useBookingsQuery();
 *
 * const { isRefreshing, handleRefresh } = usePullToRefreshMany([
 *   refetchTrips,
 *   refetchMyTrips,
 *   refetchBookings,
 * ]);
 */
export function usePullToRefreshMany(
  refetchers: Array<() => Promise<unknown>>
): {
  isRefreshing: boolean;
  handleRefresh: () => Promise<void>;
} {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Run all refetches in parallel, each with separate catch
      // so one failure doesn't block the rest
      await Promise.all(
        refetchers.map((refetch) =>
          refetch().catch((error) => {
            // Log error but don't throw — other refetches should complete
            console.error("[usePullToRefreshMany] refetch failed:", error);
          })
        )
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchers]);

  return { isRefreshing, handleRefresh };
}
