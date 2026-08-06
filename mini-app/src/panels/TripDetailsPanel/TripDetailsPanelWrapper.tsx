// mini-app/src/panels/TripDetailsPanel/TripDetailsPanelWrapper.tsx
import { type FC } from "react";
import { useParams, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { Panel, ScreenSpinner, PanelHeaderBack } from "@vkontakte/vkui";
import { TripDetailsPanel } from "@/panels/TripDetailsPanel/TripDetailsPanel";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useTripDetailQuery } from "@/queries/useTripsQuery";
import { useModalApi } from "@/providers/ModalProvider";

export const TripDetailsPanelWrapper: FC<{ id: string }> = ({ id }) => {
  const params = useParams<"tripId">();
  const routeNavigator = useRouteNavigator();
  const modalApi = useModalApi();

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

  const onOpenDriver = async () => {
    if (!trip) {
      return;
    }
    const { DriverProfileModal } = await import("@/modals/DriverProfileModal/DriverProfileModal");
    modalApi.openCustomModalCard({
      component: DriverProfileModal,
      additionalProps: { driverId: trip.driver.id },
    });
  };

  return (
    <TripDetailsPanel
      id={id}
      trip={trip ?? null}
      onBack={() => routeNavigator.back()}
      onOpenDriver={onOpenDriver}
    />
  );
};
