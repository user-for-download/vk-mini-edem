import { type FC, lazy, Suspense } from "react";
import { PanelSpinner, View } from "@vkontakte/vkui";
import { useGetPanelForView, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { PANEL_HOME, PANEL_TRIP_DETAILS } from "@/consts/panels";
import { VIEW_HOME } from "@/consts/views";
import type { Role, User } from "@/types";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
const HomePanel = lazy(() =>
  import("@/views/HomeView/panels/HomePanel/HomePanel").then((m) => ({
    default: m.HomePanel,
  }))
);

const TripDetailsPanelWrapper = lazy(() =>
  import("@/panels/TripDetailsPanel/TripDetailsPanelWrapper").then((m) => ({
    default: m.TripDetailsPanelWrapper,
  }))
);

export interface HomeViewProps {
  id: string;
  role: Role;
  onGoSearch: () => void;
  onOpenCreateTrip: () => void;
  onOpenDriverProfile: (driver: User) => void;
}

export const HomeView: FC<HomeViewProps> = ({ id, role, onGoSearch, onOpenCreateTrip }) => {
  const activePanel = useGetPanelForView(VIEW_HOME) || PANEL_HOME;
  const routeNavigator = useRouteNavigator();

  const openTrip = (tripId: string) => {
    routeNavigator.push(`/home/trip/${tripId}`);
  };

  return (
    <Suspense fallback={<PanelSpinner />}>
      <ViewErrorBoundary>
        <View id={id} activePanel={activePanel}>
          <HomePanel
            id={PANEL_HOME}
            role={role}
            onOpenTrip={(trip) => openTrip(trip.id)}
            onGoSearch={onGoSearch}
            onOpenCreateTrip={onOpenCreateTrip}
          />
          <TripDetailsPanelWrapper id={PANEL_TRIP_DETAILS} role={role} />
        </View>
      </ViewErrorBoundary>
    </Suspense>
  );
};
