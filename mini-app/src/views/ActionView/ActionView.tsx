import { type FC, lazy, Suspense } from "react";
import { PanelSpinner, View } from "@vkontakte/vkui";
import { useGetPanelForView, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import {
  PANEL_SEARCH,
  PANEL_TRIPS_MANAGE,
  PANEL_TRIP_DETAILS,
  PANEL_TRIP_REQUESTS,
  PANEL_RIDE_REQUESTS,
  PANEL_PASSENGER_BOOKINGS,
  PANEL_PASSENGER_HISTORY,
} from "@/consts/panels";
import { VIEW_ACTION } from "@/consts/views";
import type { Role, Trip, User } from "@/types";
import { loadLazyModule } from "@/helpers/loadModule";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
const SearchPanel = lazy(() =>
  loadLazyModule(() => import("@/views/ActionView/panels/SearchPanel/SearchPanel")).then((m) => ({
    default: m.SearchPanel,
  }))
);

const TripsManagePanel = lazy(() =>
  loadLazyModule(() => import("@/views/ActionView/panels/TripsManagePanel/TripsManagePanel")).then((m) => ({
    default: m.TripsManagePanel,
  }))
);

const TripRequestsPanelWrapper = lazy(() =>
  loadLazyModule(() => import("@/views/ActionView/panels/TripRequestsPanel/TripRequestsPanelWrapper")).then((m) => ({
    default: m.TripRequestsPanelWrapper,
  }))
);
const PassengerBookingsPanel = lazy(() =>
  loadLazyModule(() => import("@/views/ActionView/panels/PassengerBookingsPanel/PassengerBookingsPanel")).then((m) => ({
    default: m.PassengerBookingsPanel,
  }))
);
const PassengerHistoryPanel = lazy(() =>
  loadLazyModule(() => import("@/views/ActionView/panels/PassengerHistoryPanel/PassengerHistoryPanel")).then((m) => ({
    default: m.PassengerHistoryPanel,
  }))
);
const TripDetailsPanelWrapper = lazy(() =>
  loadLazyModule(() => import("@/panels/TripDetailsPanel/TripDetailsPanelWrapper")).then((m) => ({
    default: m.TripDetailsPanelWrapper,
  }))
);
const RideRequestsPanel = lazy(() =>
  loadLazyModule(() => import("@/views/ActionView/panels/RideRequestsPanel/RideRequestsPanel")).then((m) => ({
    default: m.RideRequestsPanel,
  }))
);

export interface ActionViewProps {
  id: string;
  role: Role;
  onOpenCreateTrip: () => void;
  onOpenDriverProfile: (driver: User) => void;
  onOpenReviewForTrip?: (trip: Trip) => void;
}

export const ActionView: FC<ActionViewProps> = ({
  id,
  role,
  onOpenCreateTrip,
  onOpenReviewForTrip,
}) => {
  const routeNavigator = useRouteNavigator();
  const activePanel = useGetPanelForView(VIEW_ACTION) || (role === "driver" ? PANEL_TRIPS_MANAGE : PANEL_SEARCH);

  return (
    <Suspense fallback={<PanelSpinner />}>
      <ViewErrorBoundary>
        <View id={id} activePanel={activePanel}>
           <SearchPanel id={PANEL_SEARCH} onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)} onOpenRideRequests={() => routeNavigator.push("/ride-requests")} />
          <TripsManagePanel
            id={PANEL_TRIPS_MANAGE}
            onOpenCreateTrip={onOpenCreateTrip}
            onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)}
          />
          <TripRequestsPanelWrapper id={PANEL_TRIP_REQUESTS} />
          <PassengerBookingsPanel
            id={PANEL_PASSENGER_BOOKINGS}
            onBack={() => routeNavigator.back()}
            onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)}
            onOpenReview={(trip) => onOpenReviewForTrip?.(trip)}
            onGoSearch={() => routeNavigator.push("/trips/search")}
          />
          <PassengerHistoryPanel
            id={PANEL_PASSENGER_HISTORY}
            onBack={() => routeNavigator.back()}
            onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)}
            onOpenReview={(trip) => onOpenReviewForTrip?.(trip)}
            onGoSearch={() => routeNavigator.push("/trips/search")}
          />
           <TripDetailsPanelWrapper id={PANEL_TRIP_DETAILS} />
           <RideRequestsPanel id={PANEL_RIDE_REQUESTS} onBack={() => routeNavigator.back()} />
        </View>
      </ViewErrorBoundary>
    </Suspense>
  );
};
