import { useEffect, useRef } from "react";
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  backButton,
  hapticFeedback,
  useLaunchParams,
} from "@telegram-apps/sdk-react";
import { Tabbar } from "@telegram-apps/telegram-ui";
import { SearchPage } from "@/pages/SearchPage";
import { TripDetailsPage } from "@/pages/TripDetailsPage";
import { MyTripsPage } from "@/pages/MyTripsPage";
import { PassengerBookingsPage } from "@/pages/PassengerBookingsPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { RideRequestsPage } from "@/pages/RideRequestsPage";
import { TripRequestsPage } from "@/pages/TripRequestsPage";
import { CreateTripPage } from "@/pages/CreateTripPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ReviewsPage } from "@/pages/ReviewsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { SupportPage } from "@/pages/SupportPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { VehiclePage } from "@/pages/VehiclePage";
import {
  parseTripStartParam,
  resolveStartParamRoute,
} from "@/router/deepLinks";

export { parseTripStartParam };

const ROOT_ROUTES = new Set(["/trips", "/bookings", "/trips/my", "/profile"]);

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const didHandleStartParam = useRef(false);
  const launchParams = useLaunchParams(true);
  const startParam = launchParams.tgWebAppStartParam;
  const isRoot = ROOT_ROUTES.has(location.pathname);

  useEffect(() => {
    const handleBack = () => {
      const historyIndex = window.history.state?.idx;
      if (typeof historyIndex === "number" && historyIndex > 0) navigate(-1);
      else navigate("/trips", { replace: true });
    };
    backButton.onClick(handleBack);
    return () => backButton.offClick(handleBack);
  }, [navigate]);

  useEffect(() => {
    if (isRoot) backButton.hide.ifAvailable();
    else backButton.show.ifAvailable();
  }, [isRoot]);

  useEffect(() => {
    if (didHandleStartParam.current) return;
    // resolveStartParamRoute: известный токен → маршрут раздела/поездки,
    // неизвестный — безопасный fallback на /trips, пустого нет (null).
    const target = resolveStartParamRoute(startParam);
    if (!target) return;
    didHandleStartParam.current = true;
    navigate(target, { replace: true });
  }, [navigate, startParam]);

  const activeTab = location.pathname.startsWith("/bookings")
    ? "bookings"
    : location.pathname.startsWith("/trips/my")
      ? "my-trips"
      : location.pathname.startsWith("/profile") || location.pathname.startsWith("/settings") || location.pathname.startsWith("/reviews") || location.pathname.startsWith("/notifications")
        ? "profile"
        : "trips";

  return (
    <div className="AppShell">
      <main className="AppShell__content"><Outlet /></main>
      <nav aria-label="Основные разделы"><Tabbar className="AppShell__tabbar">
        <Tabbar.Item
          text="Поиск"
          selected={activeTab === "trips"}
          onClick={() => {
            hapticFeedback.selectionChanged.ifAvailable();
            navigate("/trips");
          }}
        />
        <Tabbar.Item
          text="Мои брони"
          selected={activeTab === "bookings"}
          onClick={() => {
            hapticFeedback.selectionChanged.ifAvailable();
            navigate("/bookings");
          }}
        />
        <Tabbar.Item
          text="Мои поездки"
          selected={activeTab === "my-trips"}
          onClick={() => {
            hapticFeedback.selectionChanged.ifAvailable();
            navigate("/trips/my");
          }}
        />
        <Tabbar.Item
          text="Профиль"
          selected={activeTab === "profile"}
          onClick={() => {
            hapticFeedback.selectionChanged.ifAvailable();
            navigate("/profile");
          }}
        />
      </Tabbar></nav>
    </div>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/trips" element={<SearchPage />} />
          <Route path="/trips/:tripId" element={<TripDetailsPage />} />
          <Route path="/trips/my" element={<MyTripsPage />} />
          <Route path="/trips/my/:tripId/requests" element={<TripRequestsPage />} />
          <Route path="/trips/my/new" element={<CreateTripPage />} />
          <Route path="/bookings" element={<PassengerBookingsPage />} />
          <Route path="/bookings/history" element={<HistoryPage />} />
          <Route path="/ride-requests" element={<RideRequestsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile/support" element={<SupportPage />} />
          <Route path="/profile/reports" element={<ReportsPage />} />
          <Route path="/vehicle" element={<VehiclePage />} />
          <Route path="*" element={<Navigate to="/trips" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
