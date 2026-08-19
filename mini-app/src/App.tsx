/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Epic, SplitCol, SplitLayout } from "@vkontakte/vkui";
import {
  useActiveVkuiLocation,
  useFirstPageCheck,
  useRouteNavigator,
  usePopout,
} from "@vkontakte/vk-mini-apps-router";

import { VIEW_ACTION, VIEW_HOME, VIEW_PROFILE, type ViewId } from "@/consts/views";
import type { Role, Trip, User } from "@/types";
import { AppTabbar } from "@/components/AppTabbar";
import { HomeView } from "@/views/HomeView/HomeView";
import { ActionView } from "@/views/ActionView/ActionView";
import { ProfileView } from "@/views/ProfileView/ProfileView";
import { SwipeBackSync } from "@/hooks/useSwipeBackSync";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { parseDeepLink } from "@/helpers/deepLink";
import { useModalApi } from "@/providers/ModalProvider";
import { loadModule } from "@/helpers/loadModule";

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

  const {
    view: activeView = VIEW_HOME,
    modal,
    hasOverlay,
  } = useActiveVkuiLocation();
  const isFirstPage = useFirstPageCheck();
  const routeNavigator = useRouteNavigator();
  const routerPopout = usePopout();
  const modalApi = useModalApi();
  const deepLinkHandledRef = useRef(false);

  const openDriverProfile = useCallback(async (driverOrId: User | string) => {
    const driverId = typeof driverOrId === "string" ? driverOrId : driverOrId.id;
    const module = await loadModule(() => import("@/modals/DriverProfileModal/DriverProfileModal"));
    if (!module) return;
    const { DriverProfileModal } = module;
    modalApi.openCustomModalCard({
      component: DriverProfileModal,
      additionalProps: { driverId },
    });
  }, [modalApi]);

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    const deepLink = parseDeepLink();

    if (deepLink.tripId) {
      void routeNavigator.replace(`/trips/${encodeURIComponent(deepLink.tripId)}`);
      return;
    }

    if (deepLink.openHistory) {
      void routeNavigator.replace("/bookings/history");
      return;
    }

    if (deepLink.driverId) {
      openDriverProfile(deepLink.driverId).catch(() => {
        // deeplink fallback: молча игнорируем, пользователь останется на главной
      });
    }
  }, [routeNavigator, openDriverProfile]);

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
    const module = await loadModule(() => import("@/modals/CreateTripModal/CreateTripModal"));
    if (!module) return;
    const { CreateTripModal } = module;
    modalApi.openCustomModalPage({
      component: CreateTripModal,
      additionalProps: { onTripCreated: handleTripCreated },
      baseProps: { settlingHeight: 100 },
    });
  };

  const openSelectReviewTrip = async () => {
    const module = await loadModule(() => import("@/modals/SelectReviewTripModal/SelectReviewTripModal"));
    if (!module) return;
    const { SelectReviewTripModal } = module;
    modalApi.openCustomModalPage({
      component: SelectReviewTripModal,
      additionalProps: { onSelectTrip: handleSelectReviewTrip },
      baseProps: { settlingHeight: 100 },
    });
  };

  const openReviewForTrip = async (trip: Trip) => {
    const module = await loadModule(() => import("@/modals/CreateReviewModal/CreateReviewModal"));
    if (!module) return;
    const { CreateReviewModal } = module;
    modalApi.openCustomModalCard({
      component: CreateReviewModal,
      additionalProps: { trip },
    });
  };

  const handleSelectReviewTrip = (trip: Trip) => {
    void openReviewForTrip(trip);
  };

  const openCarForm = async () => {
    const module = await loadModule(() => import("@/modals/CarFormModal/CarFormModal"));
    if (!module) return;
    const { CarFormModal } = module;
    modalApi.openCustomModalPage({
      component: CarFormModal,
      baseProps: { settlingHeight: 100 },
    });
  };

  const openEditProfile = async () => {
    const module = await loadModule(() => import("@/modals/EditProfileModal/EditProfileModal"));
    if (!module) return;
    const { EditProfileModal } = module;
    modalApi.openCustomModalPage({
      component: EditProfileModal,
      baseProps: { settlingHeight: 100 },
    });
  };

  return (
    <>
      <OfflineBanner isOnline={isOnline} wasOffline={wasOffline} />
      {!isFirstPage && !modal && !hasOverlay ? <SwipeBackSync /> : null}
      <SplitLayout center>
        <SplitCol autoSpaced stretchedOnMobile maxWidth="720px">
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
    </>
  );
}
