/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from "react";
import { Epic, SplitCol, SplitLayout } from "@vkontakte/vkui";
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

export default function App() {
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

  const activeModal = routerModal || searchParams.get("modal") || null;

  const driverId = searchParams.get("driverId");

  const [reviewTripState, setReviewTripState] = useState<Trip | null>(null);

  const reviewTrip = reviewTripState;

  useSwipeBackSync();

  const closeModal = () => {
    setReviewTripState(null);
    if (searchParams.has("modal")) {
      setSearchParams(
        (prev) => {
          prev.delete("modal");
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
    setSearchParams(
      (prev) => {
        prev.set("modal", MODAL_CREATE_REVIEW);
        prev.set("tripId", trip.id);
        return prev;
      },
      { replace: true }
    );
    routeNavigator.showModal(MODAL_CREATE_REVIEW);
  };

  const handleSelectReviewTrip = (trip: Trip) => {
    setReviewTripState(trip);
    setSearchParams(
      (prev) => {
        prev.set("tripId", trip.id);
        return prev;
      },
      { replace: true }
    );
    routeNavigator.showModal(MODAL_CREATE_REVIEW);
  };

  const openCarForm = () => {
    setSearchParams((prev) => {
      prev.set("modal", MODAL_CAR_FORM);
      return prev;
    });
    routeNavigator.showModal(MODAL_CAR_FORM);
  };

  const openEditProfile = () => {
    setSearchParams((prev) => {
      prev.set("modal", MODAL_EDIT_PROFILE);
      return prev;
    });
    routeNavigator.showModal(MODAL_EDIT_PROFILE);
  };

  return (
    <>
      <SplitLayout
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
