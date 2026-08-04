import { createHashRouter } from "@vkontakte/vk-mini-apps-router";
import { VIEW_HOME, VIEW_ACTION, VIEW_PROFILE } from "@/consts/views";
import {
  PANEL_HOME,
  PANEL_SEARCH,
  PANEL_TRIPS_MANAGE,
  PANEL_TRIP_REQUESTS,
  PANEL_MY_BOOKINGS,
  PANEL_PASSENGER_BOOKINGS,
  PANEL_PASSENGER_HISTORY,
  PANEL_TRIP_DETAILS,
  PANEL_PROFILE,
  PANEL_SETTINGS_NOTIFICATIONS,
  PANEL_SETTINGS_SUPPORT,
  PANEL_SETTINGS_ABOUT,
} from "@/consts/panels";

export const router = createHashRouter([
  // HomeView
  {
    path: "/",
    view: VIEW_HOME,
    panel: PANEL_HOME,
  },
  {
    path: "/home/trip/:tripId",
    view: VIEW_HOME,
    panel: PANEL_TRIP_DETAILS,
  },

  // ActionView
  {
    path: "/trips",
    view: VIEW_ACTION,
    panel: PANEL_SEARCH,
  },
  {
    path: "/trips/search",
    view: VIEW_ACTION,
    panel: PANEL_SEARCH,
  },
  {
    path: "/trips/my",
    view: VIEW_ACTION,
    panel: PANEL_TRIPS_MANAGE,
  },
  {
    path: "/trips/my/:tripId/requests",
    view: VIEW_ACTION,
    panel: PANEL_TRIP_REQUESTS,
  },
  {
    path: "/bookings",
    view: VIEW_ACTION,
    panel: PANEL_PASSENGER_BOOKINGS,
  },
  {
    path: "/bookings/my",
    view: VIEW_ACTION,
    panel: PANEL_MY_BOOKINGS,
  },
  {
    path: "/bookings/history",
    view: VIEW_ACTION,
    panel: PANEL_PASSENGER_HISTORY,
  },
  {
    path: "/trips/:tripId",
    view: VIEW_ACTION,
    panel: PANEL_TRIP_DETAILS,
  },

  // ProfileView
  {
    path: "/profile",
    view: VIEW_PROFILE,
    panel: PANEL_PROFILE,
  },
  {
    path: "/profile/notifications",
    view: VIEW_PROFILE,
    panel: PANEL_SETTINGS_NOTIFICATIONS,
  },
  {
    path: "/profile/support",
    view: VIEW_PROFILE,
    panel: PANEL_SETTINGS_SUPPORT,
  },
  {
    path: "/profile/about",
    view: VIEW_PROFILE,
    panel: PANEL_SETTINGS_ABOUT,
  },
  {
    path: "*",
    view: VIEW_HOME,
    panel: PANEL_HOME,
  },
]);
