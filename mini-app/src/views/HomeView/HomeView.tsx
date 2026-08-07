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

/**
 * Обёртка Suspense для одной панели.
 * При первом переходе на ленивую панель suspend-ится только она,
 * а не весь View — сохраняется плавная VKUI-анимация.
 */
const LazyPanel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PanelSpinner />}>{children}</Suspense>
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
    <ViewErrorBoundary>
      <View id={id} activePanel={activePanel}>
        <LazyPanel>
          <HomePanel
            id={PANEL_HOME}
            role={role}
            onOpenTrip={(trip) => openTrip(trip.id)}
            onGoSearch={onGoSearch}
            onOpenCreateTrip={onOpenCreateTrip}
          />
        </LazyPanel>
        <LazyPanel>
          <TripDetailsPanelWrapper id={PANEL_TRIP_DETAILS} />
        </LazyPanel>
      </View>
    </ViewErrorBoundary>
  );
};
