import { type FC, lazy, Suspense } from "react";
import { PanelSpinner, View } from "@vkontakte/vkui";
import { useGetPanelForView, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import {
  PANEL_PROFILE,
  PANEL_SETTINGS_ABOUT,
  PANEL_SETTINGS_NOTIFICATIONS,
  PANEL_SETTINGS_SUPPORT,
  PANEL_ABOUT_TERMS,
  PANEL_ABOUT_PRIVACY,
} from "@/consts/panels";
import { VIEW_PROFILE } from "@/consts/views";
import type { Role, Trip } from "@/types";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
const ProfilePanel = lazy(() =>
  import("@/views/ProfileView/panels/ProfilePanel/ProfilePanel").then((m) => ({
    default: m.ProfilePanel,
  }))
);

const NotificationsPanel = lazy(() =>
  import("@/views/ProfileView/panels/NotificationsPanel/NotificationsPanel").then((m) => ({
    default: m.NotificationsPanel,
  }))
);
const SupportPanel = lazy(() =>
  import("@/views/ProfileView/panels/SupportPanel/SupportPanel").then((m) => ({
    default: m.SupportPanel,
  }))
);
const AboutPanel = lazy(() =>
  import("@/views/ProfileView/panels/AboutPanel/AboutPanel").then((m) => ({
    default: m.AboutPanel,
  }))
);
const TermsPanel = lazy(() =>
  import("@/views/ProfileView/panels/AboutPanel/TermsPanel").then((m) => ({
    default: m.TermsPanel,
  }))
);
const PrivacyPanel = lazy(() =>
  import("@/views/ProfileView/panels/AboutPanel/PrivacyPanel").then((m) => ({
    default: m.PrivacyPanel,
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

export interface ProfileViewProps {
  id: string;
  role: Role;
  onChangeRole: (role: Role) => void;
  onOpenCreateReview: () => void;
  onOpenReviewForTrip?: (trip: Trip) => void;
  onOpenCarForm?: () => void;
  onOpenEditProfile?: () => void;
}

export const ProfileView: FC<ProfileViewProps> = ({
  id,
  role,
  onChangeRole,
  onOpenCreateReview,
  onOpenReviewForTrip,
  onOpenCarForm,
  onOpenEditProfile,
}) => {
  const activePanel = useGetPanelForView(VIEW_PROFILE) || PANEL_PROFILE;
  const routeNavigator = useRouteNavigator();

  const backToProfile = () => routeNavigator.back();

  return (
    <ViewErrorBoundary>
      <View id={id} activePanel={activePanel}>
        <LazyPanel>
          <ProfilePanel
            id={PANEL_PROFILE}
            role={role}
            onChangeRole={onChangeRole}
            onOpenCreateReview={onOpenCreateReview}
            onOpenReviewForTrip={onOpenReviewForTrip}
            onOpenCarForm={onOpenCarForm}
            onOpenEditProfile={onOpenEditProfile}
            onOpenMyBookings={() => routeNavigator.push("/bookings")}
            onOpenHistory={() => routeNavigator.push("/bookings/history")}
            onOpenNotifications={() => routeNavigator.push("/profile/notifications")}
            onOpenSupport={() => routeNavigator.push("/profile/support")}
            onOpenAbout={() => routeNavigator.push("/profile/about")}
          />
        </LazyPanel>
        <LazyPanel>
          <NotificationsPanel id={PANEL_SETTINGS_NOTIFICATIONS} onBack={backToProfile} />
        </LazyPanel>
        <LazyPanel>
          <SupportPanel id={PANEL_SETTINGS_SUPPORT} onBack={backToProfile} />
        </LazyPanel>
        <LazyPanel>
          <AboutPanel id={PANEL_SETTINGS_ABOUT} onBack={backToProfile} />
        </LazyPanel>
        <LazyPanel>
          <TermsPanel id={PANEL_ABOUT_TERMS} onBack={backToProfile} />
        </LazyPanel>
        <LazyPanel>
          <PrivacyPanel id={PANEL_ABOUT_PRIVACY} onBack={backToProfile} />
        </LazyPanel>
      </View>
    </ViewErrorBoundary>
  );
};
