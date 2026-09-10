import { useMemo } from "react";
import { Button, List, Placeholder, Section } from "@telegram-apps/telegram-ui";
import { PageHeader } from "@/components/PageHeader";
import { MutationError } from "@/components/MutationError";
import { QueryState } from "@/components/QueryState";
import { ApiError } from "@/api/client";
import type { Notification } from "@edem/contracts";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsInboxQuery,
} from "@/queries/useNotificationsQuery";

/**
 * Типы, которые backend создаёт даже при выключенном тумблере
 * (зеркало CRITICAL_NOTIFICATION_TYPES из notification.service.ts).
 * Контракт: docs/migration/notification-parity-contract.md.
 */
export const CRITICAL_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  "booking_status_changed",
  "trip_cancelled",
  "trip_status_changed",
]);

export function isCriticalNotification(type: string): boolean {
  return CRITICAL_NOTIFICATION_TYPES.has(type);
}

/**
 * Deep-link маршрута по типу уведомления (контракт parity).
 *
 * Notification не несёт entity-id (только id/userId/type/title/body),
 * поэтому ссылки — на уровень разделов, а не конкретных сущностей:
 * per-entity deep-links (trip_<uuid>, booking-specific) заблокированы,
 * пока payload не несёт идентификаторы. Неизвестные типы — без ссылки
 * (честно null, не выдуманный маршрут).
 */
export const NOTIFICATION_ROUTES: Readonly<Record<string, string>> = {
  booking_created: "/trips/my",
  booking_status_changed: "/bookings",
  trip_cancelled: "/bookings",
  trip_status_changed: "/bookings/history",
  trip_details_changed: "/trips",
  ride_request_match: "/trips",
  review_approved: "/reviews",
  review_rejected: "/reviews",
  feedback_replied: "/profile/support",
};

export function notificationRoute(type: string): string | null {
  return NOTIFICATION_ROUTES[type] ?? null;
}

function formatDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationCard({
  notification,
  onMarkRead,
  marking,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  marking: boolean;
}) {
  const route = notificationRoute(notification.type);
  const critical = isCriticalNotification(notification.type);
  return (
    <article className="NotificationCard" data-read={notification.isRead}>
      <p className="NotificationCard__head">
        {notification.title}
        {critical && (
          <span className="NotificationCard__badge" data-critical="true">
            {" "}
            · Важное
          </span>
        )}
        {!notification.isRead && !critical && (
          <span className="NotificationCard__badge" data-critical="false">
            {" "}
            · Новое
          </span>
        )}
      </p>
      <p className="NotificationCard__text">{notification.body}</p>
      <p className="NotificationCard__date">{formatDate(notification.createdAt)}</p>
      <div className="NotificationCard__actions">
        {route && (
          <a className="NotificationCard__link" href={`#${route}`}>
            Открыть
          </a>
        )}
        {!notification.isRead && (
          <Button
            size="s"
            mode="outline"
            loading={marking}
            disabled={marking}
            onClick={() => onMarkRead(notification.id)}
          >
            Отметить прочитанным
          </Button>
        )}
      </div>
    </article>
  );
}

/**
 * Уведомления Telegram-пользователя (inbox — authoritative канал parity:
 * персист + WebSocket-хинт, Bot API — blocked и здесь не предполагается).
 *
 * - Cursor-пагинация (limit 20, «Показать ещё»);
 * - прочитать одно / прочитать все (оптимистичный кэш);
 * - критичные статусы всегда в inbox независимо от тумблера
 *   (подпись + ссылка на /settings).
 */
export function NotificationsPage() {
  const inbox = useNotificationsInboxQuery(20);
  const markRead = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();

  const items = useMemo(
    () => inbox.data?.pages.flatMap((page) => page.items) ?? [],
    [inbox.data],
  );
  const unreadCount = inbox.data?.pages[0]?.unreadCount ?? 0;

  // Бан mid-session: requireUser отвечает 403 — терминальный экран вместо
  // общей ошибки (паттерн ProfilePage; глобальные случаи закрывает AuthGate).
  if (inbox.error instanceof ApiError && inbox.error.status === 403) {
    return (
      <>
        <PageHeader title="Уведомления" />
        <Placeholder
          header="Аккаунт заблокирован"
          description="Действие недоступно: аккаунт заблокирован."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Уведомления" />
      <MutationError error={markRead.error ?? markAll.error} />
      <QueryState
        loading={inbox.isLoading}
        error={inbox.error}
        empty={false}
        emptyText=""
        onRetry={() => void inbox.refetch()}
      >
        <Section>
          <p className="SettingsStatus" aria-live="polite">
            {unreadCount > 0
              ? `Непрочитанных: ${unreadCount}.`
              : "Все уведомления прочитаны."}{" "}
            Важные статусы поездки и брони сохраняются всегда, даже если
            некритичные уведомления выключены.
          </p>
          <List>
            <a className="NotificationCard__link" href="#/settings">
              Настройки уведомлений
            </a>
          </List>
          <div className="ButtonRow">
            <Button
              stretched
              mode="outline"
              loading={markAll.isPending}
              disabled={markAll.isPending || unreadCount === 0}
              onClick={() => markAll.mutate()}
            >
              Прочитать все
            </Button>
          </div>
        </Section>

        {items.length === 0 ? (
          <Section>
            <p className="ReviewEmpty__title">Пока нет уведомлений</p>
            <p className="ReviewEmpty__subtitle">
              Подтверждения брони, отмены и завершение поездок появятся здесь
            </p>
          </Section>
        ) : (
          <Section>
            <List>
              {items.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  marking={markRead.isPending}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
              ))}
            </List>
            {inbox.hasNextPage && (
              <div className="ButtonRow">
                <Button
                  mode="outline"
                  stretched
                  loading={inbox.isFetchingNextPage}
                  disabled={inbox.isFetchingNextPage}
                  onClick={() => void inbox.fetchNextPage()}
                >
                  Показать ещё
                </Button>
              </div>
            )}
          </Section>
        )}
      </QueryState>
    </>
  );
}
