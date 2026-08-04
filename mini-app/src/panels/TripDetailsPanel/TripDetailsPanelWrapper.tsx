// mini-app/src/panels/TripDetailsPanel/TripDetailsPanelWrapper.tsx
import { type FC } from "react";
import {
  useParams,
  useRouteNavigator,
  useSearchParams,
} from "@vkontakte/vk-mini-apps-router";
import { Panel, ScreenSpinner, PanelHeaderBack } from "@vkontakte/vkui";
import { TripDetailsPanel } from "@/panels/TripDetailsPanel/TripDetailsPanel";
import { MODAL_DRIVER_PROFILE } from "@/consts/modals";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useTripDetailQuery } from "@/queries/useTripsQuery";
import type { Role } from "@/types";

export const TripDetailsPanelWrapper: FC<{ id: string; role: Role }> = ({
  id,
  role,
}) => {
  const params = useParams<"tripId">();
  const routeNavigator = useRouteNavigator();
  const [, setSearchParams] = useSearchParams();

  const tripId = params?.tripId;

  const { data: trip, isLoading } = useTripDetailQuery(tripId ?? "");

  if (!tripId) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={() => routeNavigator.back()} aria-label="Назад" />}
        >
          Поездка
        </AppPanelHeader>
      </Panel>
    );
  }

  if (isLoading && !trip) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={() => routeNavigator.back()} aria-label="Назад" />}
        >
          Поездка
        </AppPanelHeader>
        <ScreenSpinner state="loading" />
      </Panel>
    );
  }

  return (
    <TripDetailsPanel
      id={id}
      trip={trip ?? null}
      role={role}
      onBack={() => routeNavigator.back()}
      onOpenDriver={() => {
        if (trip) {
          setSearchParams(
            (prev) => {
              prev.set("driverId", trip.driver.id);
              return prev;
            },
            { replace: true }
          );

          routeNavigator.showModal(MODAL_DRIVER_PROFILE);
        }
      }}
    />
  );
};
