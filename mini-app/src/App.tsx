/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from "react";
import { Epic, SplitCol, SplitLayout, PanelHeader } from "@vkontakte/vkui";
import {
  useActiveVkuiLocation,
  useRouteNavigator,
  useSearchParams,
  usePopout,
} from "@vkontakte/vk-mini-apps-router";

import { VIEW_ACTION, VIEW_HOME, VIEW_PROFILE, type ViewId } from "@/consts/views";
import {
  MODAL_CAR_FORM,
  MODAL_CREATE_REVIEW,
  MODAL_CREATE_TRIP,
  MODAL_DRIVER_PROFILE,
  MODAL_EDIT_PROFILE,
  MODAL_SELECT_REVIEW_TRIP,
} from "@/consts/modals";
import type { Role, Trip, User } from "@/types";
import { AppTabbar } from "@/components/AppTabbar";
import { AppModalRoot } from "@/components/AppModalRoot";
import { AppSnackbar } from "@/components/AppSnackbar";
import { HomeView } from "@/views/HomeView/HomeView";
import { ActionView } from "@/views/ActionView/ActionView";
import { ProfileView } from "@/views/ProfileView/ProfileView";
import { useSwipeBackSync } from "@/hooks/useSwipeBackSync";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { parseDeepLink } from "@/helpers/deepLink";
import { useWebSocket } from "@/hooks/useWebSocket";

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

  const { view: activeView = VIEW_HOME, modal: routerModal } = useActiveVkuiLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeNavigator = useRouteNavigator();
  const routerPopout = usePopout();

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeModal = routerModal || null;

  const driverId = searchParams.get("driverId");

  const [reviewTripState, setReviewTripState] = useState<Trip | null>(null);

  const reviewTrip = reviewTripState;

  useSwipeBackSync();
  useWebSocket();

  const closeModal = () => {
    setReviewTripState(null);
    if (searchParams.has("driverId") || searchParams.has("tripId")) {
      setSearchParams(
        (prev) => {
          prev.delete("driverId");
          prev.delete("tripId");
          return prev;
        },
        { replace: true }
      );
    }
    if (routerModal) {
      routeNavigator.hideModal();
    }
  };

  const goToSearch = () => {
    setRole("passenger");
    routeNavigator.push("/trips/search");
  };

  const openCreateTrip = () => {
    routeNavigator.showModal(MODAL_CREATE_TRIP);
  };

  const handleTripCreated = () => {
    setRole("driver");
    closeModal();
    routeNavigator.push("/trips/my");
  };

  const openDriverProfile = (driver: User) => {
    setSearchParams(
      (prev) => {
        prev.set("driverId", driver.id);
        return prev;
      },
      { replace: true }
    );
    routeNavigator.showModal(MODAL_DRIVER_PROFILE);
  };

  const openCreateReview = () => {
    routeNavigator.showModal(MODAL_SELECT_REVIEW_TRIP);
  };

  const openReviewForTrip = (trip: Trip) => {
    setReviewTripState(trip);
    setSearchParams((prev) => { prev.set("tripId", trip.id); return prev; }, { replace: true });
    routeNavigator.showModal(MODAL_CREATE_REVIEW);
  };

  const handleSelectReviewTrip = (trip: Trip) => {
    setReviewTripState(trip);
    setSearchParams((prev) => { prev.set("tripId", trip.id); return prev; }, { replace: true });
    routeNavigator.showModal(MODAL_CREATE_REVIEW);
  };

  const openCarForm = () => {
    routeNavigator.showModal(MODAL_CAR_FORM);
  };

  const openEditProfile = () => {
    routeNavigator.showModal(MODAL_EDIT_PROFILE);
  };

  return (
    <>
      <OfflineBanner isOnline={isOnline} wasOffline={wasOffline} />
      <SplitLayout
        header={<PanelHeader delimiter="none" fixed={false} />}
        popout={routerPopout}
      >
        <SplitCol>
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
              onOpenCreateReview={openCreateReview}
              onOpenReviewForTrip={openReviewForTrip}
              onOpenCarForm={openCarForm}
              onOpenEditProfile={openEditProfile}
            />
          </Epic>
        </SplitCol>
      </SplitLayout>
      <AppModalRoot
        activeModal={activeModal ?? null}
        reviewTrip={reviewTrip}
        driverId={driverId}
        onClose={closeModal}
        onTripCreated={handleTripCreated}
        onSelectReviewTrip={handleSelectReviewTrip}
      />
      <AppSnackbar />
    </>
  );
}
