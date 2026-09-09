import { Button, Cell, List, Placeholder } from "@telegram-apps/telegram-ui";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Заглушка главной (Фаза 1). Показывает авторизованного пользователя и
 * подтверждает работоспособность auth-цепочки; экраны поиска/поездок/броней —
 * Фаза 2.
 */
export function HomePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <Placeholder
      header="🚗 Едем"
      description="Сервис совместных поездок. Экраны в разработке — сейчас проверяем авторизацию."
    >
      <List>
        <Cell subtitle="Telegram ID">
          {user?.name ?? "—"}
        </Cell>
      </List>
      <Button size="l" stretched disabled>
        Найти попутку (скоро)
      </Button>
    </Placeholder>
  );
}
