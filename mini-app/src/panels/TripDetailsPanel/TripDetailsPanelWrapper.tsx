// mini-app/src/panels/TripDetailsPanel/TripDetailsPanelWrapper.tsx
import { type FC } from "react";
import { useParams, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { Box, Button, Panel, PanelHeaderBack, ScreenSpinner } from "@vkontakte/vkui";
import { TripDetailsPanel } from "@/panels/TripDetailsPanel/TripDetailsPanel";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { EmptyState } from "@/components/EmptyState";
import { useTripDetailQuery } from "@/queries/useTripsQuery";
import { useModalApi } from "@/providers/ModalProvider";

export const TripDetailsPanelWrapper: FC<{ id: string }> = ({ id }) => {
  const params = useParams<"tripId">();
  const routeNavigator = useRouteNavigator();
  const modalApi = useModalApi();

  const tripId = params?.tripId;

  const { data: trip, isLoading, isError, refetch } = useTripDetailQuery(tripId ?? "");

  if (!tripId) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={() => routeNavigator.back()} aria-label="Назад" />}
        >
          Поездка
        </AppPanelHeader>
        <EmptyState
          title="Поездка не найдена"
          subtitle="Вернитесь назад и выберите поездку снова"
        />
      </Panel>
    );
  }

  if (isLoading) {
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

  if (isError || !trip) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={() => routeNavigator.back()} aria-label="Назад" />}
        >
          Поездка
        </AppPanelHeader>
        <EmptyState
          title="Не удалось загрузить поездку"
          subtitle="Проверьте соединение и попробуйте снова"
          action={
            <Box padding="system">
              <Button size="m" mode="primary" onClick={() => refetch()}>
                Попробовать снова
              </Button>
            </Box>
          }
        />
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
      trip={trip}
      onBack={() => routeNavigator.back()}
      onOpenDriver={onOpenDriver}
    />
  );
};
