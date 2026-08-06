/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect, useCallback } from "react";
import { Epic, SplitCol, SplitLayout, PanelHeader } from "@vkontakte/vkui";
import {
  useActiveVkuiLocation,
  useRouteNavigator,
  usePopout,
} from "@vkontakte/vk-mini-apps-router";

import { VIEW_ACTION, VIEW_HOME, VIEW_PROFILE, type ViewId } from "@/consts/views";
import type { Role, Trip, User } from "@/types";
import { AppTabbar } from "@/components/AppTabbar";
import { AppSnackbar } from "@/components/AppSnackbar";
import { HomeView } from "@/views/HomeView/HomeView";
import { ActionView } from "@/views/ActionView/ActionView";
import { ProfileView } from "@/views/ProfileView/ProfileView";
import { useSwipeBackSync } from "@/hooks/useSwipeBackSync";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { parseDeepLink } from "@/helpers/deepLink";
import { useModalApi } from "@/providers/ModalProvider";

export default function App() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [role, setRole] = useState<Role>(() => {
    try {
      const storedRole = localStorage.getItem("edem-role");
      return storedRole === "driver" ? "driver" : "passenger";
    } catch {
      return "passenger";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("edem-role", role);
    } catch {
      // ignore
    }
  }, [role]);

  const { view: activeView = VIEW_HOME } = useActiveVkuiLocation();
  const routeNavigator = useRouteNavigator();
  const routerPopout = usePopout();
  const modalApi = useModalApi();

  const openDriverProfile = useCallback(async (driverOrId: User | string) => {
    const driverId = typeof driverOrId === "string" ? driverOrId : driverOrId.id;
    const { DriverProfileModal } = await import("@/modals/DriverProfileModal/DriverProfileModal");
    modalApi.openCustomModalCard({
      component: DriverProfileModal,
      additionalProps: { driverId },
    });
  }, [modalApi]);

  useEffect(() => {
    const deepLink = parseDeepLink();

    if (deepLink.tripId) {
      routeNavigator.push(`/trips/${deepLink.tripId}`);
      return;
    }

    if (deepLink.openHistory) {
      routeNavigator.push("/bookings/history");
      return;
    }

    if (deepLink.driverId) {
      openDriverProfile(deepLink.driverId).catch(() => {
        // deeplink fallback: молча игнорируем, пользователь останется на главной
      });
    }
  }, [routeNavigator, openDriverProfile]);

  useSwipeBackSync();

  const goToSearch = () => {
    setRole("passenger");
    routeNavigator.push("/trips/search");
  };

  const handleTripCreated = () => {
    setRole("driver");
    modalApi.closeAll();
    routeNavigator.push("/trips/my");
  };

  const openCreateTrip = async () => {
    const { CreateTripModal } = await import("@/modals/CreateTripModal/CreateTripModal");
    modalApi.openCustomModalPage({
      component: CreateTripModal,
      additionalProps: { onTripCreated: handleTripCreated },
      baseProps: { settlingHeight: 100 },
    });
  };

  const openSelectReviewTrip = async () => {
    const { SelectReviewTripModal } = await import("@/modals/SelectReviewTripModal/SelectReviewTripModal");
    modalApi.openCustomModalPage({
      component: SelectReviewTripModal,
      additionalProps: { onSelectTrip: handleSelectReviewTrip },
      baseProps: { settlingHeight: 100 },
    });
  };

  const openReviewForTrip = async (trip: Trip) => {
    const { CreateReviewModal } = await import("@/modals/CreateReviewModal/CreateReviewModal");
    modalApi.openCustomModalCard({
      component: CreateReviewModal,
      additionalProps: { trip },
    });
  };

  const handleSelectReviewTrip = (trip: Trip) => {
    void openReviewForTrip(trip);
  };

  const openCarForm = async () => {
    const { CarFormModal } = await import("@/modals/CarFormModal/CarFormModal");
    modalApi.openCustomModalPage({
      component: CarFormModal,
      baseProps: { settlingHeight: 100 },
    });
  };

  const openEditProfile = async () => {
    const { EditProfileModal } = await import("@/modals/EditProfileModal/EditProfileModal");
    modalApi.openCustomModalPage({
      component: EditProfileModal,
      baseProps: { settlingHeight: 100 },
    });
  };

  return (
    <>
      <OfflineBanner isOnline={isOnline} wasOffline={wasOffline} />
      <SplitLayout header={<PanelHeader delimiter="none" fixed={false} />}>
        <SplitCol autoSpaced maxWidth={720}>
          <Epic
            activeStory={activeView as ViewId}
            tabbar={<AppTabbar activeView={activeView as ViewId} role={role} />}
          >
            <HomeView
              id={VIEW_HOME}
              role={role}
              onGoSearch={goToSearch}
              onOpenCreateTrip={openCreateTrip}
              onOpenDriverProfile={openDriverProfile}
            />
            <ActionView
              id={VIEW_ACTION}
              role={role}
              onOpenCreateTrip={openCreateTrip}
              onOpenDriverProfile={openDriverProfile}
              onOpenReviewForTrip={openReviewForTrip}
            />
            <ProfileView
              id={VIEW_PROFILE}
              role={role}
              onChangeRole={setRole}
              onOpenCreateReview={openSelectReviewTrip}
              onOpenReviewForTrip={openReviewForTrip}
              onOpenCarForm={openCarForm}
              onOpenEditProfile={openEditProfile}
            />
          </Epic>
        </SplitCol>
      </SplitLayout>
      {routerPopout}
      <AppSnackbar />
    </>
  );
}
