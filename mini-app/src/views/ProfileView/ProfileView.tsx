import { type FC } from "react";
import { View } from "@vkontakte/vkui";
import { useGetPanelForView, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { PANEL_PROFILE, PANEL_SETTINGS_ABOUT, PANEL_SETTINGS_NOTIFICATIONS, PANEL_SETTINGS_SUPPORT } from "@/consts/panels";
import { VIEW_PROFILE } from "@/consts/views";
import type { Role, Trip } from "@/types";
import { ProfilePanel } from "@/views/ProfileView/panels/ProfilePanel/ProfilePanel";
import { NotificationsPanel } from "@/views/ProfileView/panels/NotificationsPanel/NotificationsPanel";
import { SupportPanel } from "@/views/ProfileView/panels/SupportPanel/SupportPanel";
import { AboutPanel } from "@/views/ProfileView/panels/AboutPanel/AboutPanel";

export interface ProfileViewProps {
  id: string;
  role: Role;
  onChangeRole: (role: Role) => void;
  onOpenCreateReview: () => void;
  onOpenReviewForTrip?: (trip: Trip) => void;
}

export const ProfileView: FC<ProfileViewProps> = ({ id, role, onChangeRole, onOpenCreateReview, onOpenReviewForTrip }) => {
  const activePanel = useGetPanelForView(VIEW_PROFILE) || PANEL_PROFILE;
  const routeNavigator = useRouteNavigator();

  const backToProfile = () => routeNavigator.back();

  return (
    <View id={id} activePanel={activePanel}>
      <ProfilePanel
        id={PANEL_PROFILE}
        role={role}
        onChangeRole={onChangeRole}
        onOpenCreateReview={onOpenCreateReview}
        onOpenReviewForTrip={onOpenReviewForTrip}
        onOpenMyBookings={() => routeNavigator.push("/bookings")}
        onOpenHistory={() => routeNavigator.push("/bookings/history")}
        onOpenNotifications={() => routeNavigator.push("/profile/notifications")}
        onOpenSupport={() => routeNavigator.push("/profile/support")}
        onOpenAbout={() => routeNavigator.push("/profile/about")}
      />
      <NotificationsPanel id={PANEL_SETTINGS_NOTIFICATIONS} onBack={backToProfile} />
      <SupportPanel id={PANEL_SETTINGS_SUPPORT} onBack={backToProfile} />
      <AboutPanel id={PANEL_SETTINGS_ABOUT} onBack={backToProfile} />
    </View>
  );
};
