import { FixedLayout, Tabbar } from "@telegram-apps/telegram-ui";
import { hapticFeedback } from "@telegram-apps/sdk-react";
import { Car, Home, Search, User } from "lucide-react";

export type AppTabId = "home" | "trips" | "search" | "profile";

const TABS = [
  { key: "home", text: "Главная", to: "/", Icon: Home },
  { key: "trips", text: "Поездки", to: "/bookings", Icon: Car },
  { key: "search", text: "Поиск", to: "/trips", Icon: Search },
  { key: "profile", text: "Профиль", to: "/profile", Icon: User },
] as const;

/**
 * Нижний таббар (язык AppTabbar примера): FixedLayout bottom + Tabbar
 * на tgui-переменных. Route-driven: активный таб определяет роутер,
 * компонент только рендерит и отдаёт выбор наружу.
 */
export function AppTabbar({
  activeTab,
  onSelect,
}: {
  activeTab: AppTabId;
  onSelect: (to: string) => void;
}) {
  return (
    <FixedLayout vertical="bottom" className="!z-50 w-full max-w-md mx-auto">
      <Tabbar className="!border-t !border-[var(--tgui--outline)] !bg-[var(--tgui--bg_color)]/95 !backdrop-blur-md">
        {TABS.map(({ key, text, to, Icon }) => {
          const selected = activeTab === key;
          return (
            <Tabbar.Item
              key={key}
              text={text}
              selected={selected}
              onClick={() => {
                if (activeTab === key) return;
                hapticFeedback.selectionChanged.ifAvailable();
                onSelect(to);
              }}
            >
              <Icon size={22} strokeWidth={selected ? 2.5 : 1.8} />
            </Tabbar.Item>
          );
        })}
      </Tabbar>
    </FixedLayout>
  );
}
