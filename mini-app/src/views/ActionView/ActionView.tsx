import { type FC } from "react";
import { View } from "@vkontakte/vkui";
import { useGetPanelForView, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import {
  PANEL_SEARCH,
  PANEL_TRIPS_MANAGE,
  PANEL_TRIP_DETAILS,
  PANEL_TRIP_REQUESTS,
  PANEL_MY_BOOKINGS,
  PANEL_PASSENGER_BOOKINGS,
  PANEL_PASSENGER_HISTORY,
} from "@/consts/panels";
import { VIEW_ACTION } from "@/consts/views";
import type { Role, Trip, User } from "@/types";
import { SearchPanel } from "@/views/ActionView/panels/SearchPanel/SearchPanel";
import { TripsManagePanel } from "@/views/ActionView/panels/TripsManagePanel/TripsManagePanel";
import { TripRequestsPanelWrapper } from "@/views/ActionView/panels/TripRequestsPanel/TripRequestsPanelWrapper";
import { MyBookingsPanel } from "@/views/ActionView/panels/MyBookingsPanel/MyBookingsPanel";
import { PassengerBookingsPanel } from "@/views/ActionView/panels/PassengerBookingsPanel/PassengerBookingsPanel";
import { PassengerHistoryPanel } from "@/views/ActionView/panels/PassengerHistoryPanel/PassengerHistoryPanel";
import { TripDetailsPanelWrapper } from "@/panels/TripDetailsPanel/TripDetailsPanelWrapper";

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
    <View id={id} activePanel={activePanel}>
      <SearchPanel id={PANEL_SEARCH} onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)} />
      <TripsManagePanel
        id={PANEL_TRIPS_MANAGE}
        onOpenCreateTrip={onOpenCreateTrip}
        onOpenTripRequests={(trip) => routeNavigator.push(`/trips/my/${trip.id}/requests`)}
      />
      <TripRequestsPanelWrapper id={PANEL_TRIP_REQUESTS} />
      <MyBookingsPanel
        id={PANEL_MY_BOOKINGS}
        onBack={() => routeNavigator.back()}
        onOpenTrip={(trip) => routeNavigator.push(`/trips/${trip.id}`)}
        onGoSearch={() => routeNavigator.push("/trips/search")}
      />
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
      <TripDetailsPanelWrapper id={PANEL_TRIP_DETAILS} role={role} />
    </View>
  );
};
