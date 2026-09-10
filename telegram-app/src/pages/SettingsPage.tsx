import { useEffect, useState } from "react";
import { Button, List, Section } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { MutationError } from "@/components/MutationError";
import { QueryState } from "@/components/QueryState";
import { useProfileQuery, useProfileNotificationSettingsMutation } from "@/queries/profile";

/**
 * Настройки уведомлений Telegram-приложения (порт VK NotificationsPanel,
 * без VK-специфики: push VK и сообщения сообщества отсутствуют —
 * уведомления доставляются внутри приложения; сообщения Telegram-бота —
 * отдельный будущий этап, не этот экран).
 *
 * Тумблер синхронизируется с backend (PATCH /users/me/notification-settings,
 * requireUser + sanitize + profileUpdateLimiter); при ошибке — откат
 * к предыдущему значению, зеркально VK-панели.
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const profile = useProfileQuery();
  const save = useProfileNotificationSettingsMutation();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (profile.data && enabled === null) {
      setEnabled(profile.data.notificationsEnabled ?? true);
    }
  }, [profile.data, enabled]);

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [showSaved]);

  const toggle = (next: boolean) => {
    if (save.isPending) return;
    const previous = enabled;
    setEnabled(next);
    save.mutate(next, {
      onSuccess: () => setShowSaved(true),
      onError: () => setEnabled(previous),
    });
  };

  return (
    <>
      <PageHeader title="Настройки" />
      <MutationError error={save.error} />
      <QueryState
        loading={profile.isLoading}
        error={profile.error}
        empty={!profile.data || enabled === null}
        emptyText="Не удалось загрузить настройки."
        onRetry={() => void profile.refetch()}
      >
        <Section>
          <List>
            <p className="SettingsStatus" aria-live="polite">
              {enabled
                ? "Уведомления включены — подтверждение брони, отмена и завершение поездки."
                : "Некритичные уведомления выключены — критичные статусы поездки и брони останутся в приложении."}
            </p>
            <Button
              stretched
              loading={save.isPending}
              disabled={save.isPending || enabled === null}
              onClick={() => toggle(!enabled)}
            >
              {enabled ? "Выключить некритичные" : "Включить уведомления"}
            </Button>
            {showSaved && (
              <p className="SettingsSaved" role="status">
                Настройки сохранены
              </p>
            )}
            <p className="SettingsHint">
              Настройка синхронизируется с аккаунтом. Отдельные настройки звука и типов уведомлений пока
              не поддерживаются.
            </p>
            <Button mode="outline" stretched onClick={() => navigate("/notifications")}>
              Открыть уведомления
            </Button>
            <Button mode="outline" stretched onClick={() => navigate("/profile")}>
              Назад в профиль
            </Button>
          </List>
        </Section>
      </QueryState>
    </>
  );
}
