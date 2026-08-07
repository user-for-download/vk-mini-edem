import { type FC, lazy, Suspense } from "react";
import { PanelSpinner, View } from "@vkontakte/vkui";
import { useGetPanelForView, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import {
  PANEL_SEARCH,
  PANEL_TRIPS_MANAGE,
  PANEL_TRIP_DETAILS,
  PANEL_TRIP_REQUESTS,
  PANEL_PASSENGER_BOOKINGS,
  PANEL_PASSENGER_HISTORY,
} from "@/consts/panels";
import { VIEW_ACTION } from "@/consts/views";
import type { Role, Trip, User } from "@/types";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
const SearchPanel = lazy(() =>
  import("@/views/ActionView/panels/SearchPanel/SearchPanel").then((m) => ({
    default: m.SearchPanel,
  }))
);

const TripsManagePanel = lazy(() =>
  import("@/views/ActionView/panels/TripsManagePanel/TripsManagePanel").then((m) => ({
    default: m.TripsManagePanel,
  }))
);

const TripRequestsPanelWrapper = lazy(() =>
  import("@/views/ActionView/panels/TripRequestsPanel/TripRequestsPanelWrapper").then((m) => ({
    default: m.TripRequestsPanelWrapper,
  }))
);
const PassengerBookingsPanel = lazy(() =>
  import("@/views/ActionView/panels/PassengerBookingsPanel/PassengerBookingsPanel").then((m) => ({
    default: m.PassengerBookingsPanel,
  }))
);
const PassengerHistoryPanel = lazy(() =>
  import("@/views/ActionView/panels/PassengerHistoryPanel/PassengerHistoryPanel").then((m) => ({
    default: m.PassengerHistoryPanel,
  }))
);
const TripDetailsPanelWrapper = lazy(() =>
  import("@/panels/TripDetailsPanel/TripDetailsPanelWrapper").then((m) => ({
    default: m.TripDetailsPanelWrapper,
  }))
);

/**
 * Обёртка Suspense для одной панели.
 * При первом переходе на ленивую панель suspend-ится только она,
 * а не весь View — сохраняется плавная VKUI-анимация.
 */
const LazyPanel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PanelSpinner />}>{children}</Suspense>
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
    <ViewErrorBoundary>
      <View id={id} activePanel={activePanel}>
        <LazyPanel>
          <SearchPanel id={PANEL_SEARCH} onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)} />
        </LazyPanel>
        <LazyPanel>
          <TripsManagePanel
            id={PANEL_TRIPS_MANAGE}
            onOpenCreateTrip={onOpenCreateTrip}
            onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)}
          />
        </LazyPanel>
        <LazyPanel>
          <TripRequestsPanelWrapper id={PANEL_TRIP_REQUESTS} />
        </LazyPanel>
        <LazyPanel>
          <PassengerBookingsPanel
            id={PANEL_PASSENGER_BOOKINGS}
            onBack={() => routeNavigator.back()}
            onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)}
            onOpenReview={(trip) => onOpenReviewForTrip?.(trip)}
            onGoSearch={() => routeNavigator.push("/trips/search")}
          />
        </LazyPanel>
        <LazyPanel>
          <PassengerHistoryPanel
            id={PANEL_PASSENGER_HISTORY}
            onBack={() => routeNavigator.back()}
            onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)}
            onOpenReview={(trip) => onOpenReviewForTrip?.(trip)}
            onGoSearch={() => routeNavigator.push("/trips/search")}
          />
        </LazyPanel>
        <LazyPanel>
          <TripDetailsPanelWrapper id={PANEL_TRIP_DETAILS} />
        </LazyPanel>
      </View>
    </ViewErrorBoundary>
  );
};
