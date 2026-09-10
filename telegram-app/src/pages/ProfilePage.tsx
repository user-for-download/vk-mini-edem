import { useEffect, useState } from "react";
import { Button, Input, List, Placeholder, Section } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { MutationError } from "@/components/MutationError";
import { QueryState } from "@/components/QueryState";
import { ApiError } from "@/api/client";
import {
  useDeleteAccountMutation,
  useLogoutMutation,
  useProfileQuery,
  useProfileUpdateMutation,
} from "@/queries/profile";
import { normalizeProfileForm, validateProfileForm } from "@/pages/profileValidation";

/**
 * Профиль Telegram-пользователя (порт VK ProfilePanel).
 *
 * Просмотр/редактирование имени и «О себе», статистика, переход в настройки,
 * выход (POST /auth/logout + локальная очистка) и удаление аккаунта
 * (двойное подтверждение, обработка активных обязательств 409).
 * Бан/удаление mid-session: requireUser отвечает 403 — показываем
 * терминальные экраны вместо общей ошибки (глобальные случаи закрывает
 * AuthGate при bootstrap/refresh).
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const profile = useProfileQuery();
  const update = useProfileUpdateMutation();
  const logout = useLogoutMutation();
  const remove = useDeleteAccountMutation();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data && !editing) {
      setName(profile.data.name ?? "");
      setAbout(profile.data.about ?? "");
    }
  }, [profile.data, editing]);

  const startEditing = () => {
    setFormError(null);
    update.reset();
    setEditing(true);
  };

  const save = () => {
    const error = validateProfileForm(name, about);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    update.mutate(normalizeProfileForm(name, about), {
      onSuccess: () => setEditing(false),
    });
  };

  const handleLogout = () => {
    if (window.confirm("Выйти из аккаунта на этом устройстве?")) {
      logout.mutate();
    }
  };

  const handleDeleteAccount = () => {
    const first = window.confirm(
      "Удалить профиль? Аккаунт будет анонимизирован, поездки и отзывы сохранятся без вашего имени. Активные поездки и брони нужно завершить или отменить заранее. Продолжить?",
    );
    if (!first) return;
    const second = window.confirm(
      "Подтвердите удаление: восстановление будет невозможно. Удалить профиль окончательно?",
    );
    if (!second) return;
    remove.mutate();
  };

  if (profile.error instanceof ApiError && profile.error.status === 403) {
    if (profile.error.message === "Account is deleted") {
      return (
        <Placeholder
          header="Профиль удалён"
          description="Аккаунт анонимизирован. Поездки и отзывы сохранены без вашего имени. Восстановление невозможно."
        />
      );
    }
    return (
      <Placeholder
        header="Аккаунт заблокирован"
        description="Действие недоступно: аккаунт заблокирован. Обжалование пока недоступно в Telegram."
      />
    );
  }

  return (
    <>
      <PageHeader title="Профиль" action={{ label: "Настройки", to: "/settings" }} />
      <MutationError error={logout.error} />
      <QueryState
        loading={profile.isLoading}
        error={profile.error}
        empty={!profile.data}
        emptyText="Не удалось загрузить профиль."
        onRetry={() => void profile.refetch()}
      >
        {profile.data && (
          <Section>
            <List>
              <div className="ProfileHead">
                {profile.data.avatar && (
                  <img
                    className="ProfileHead__avatar"
                    src={profile.data.avatar}
                    alt=""
                    width={80}
                    height={80}
                  />
                )}
                <p className="ProfileHead__name">{profile.data.name}</p>
                <p className="ProfileHead__meta">
                  Рейтинг {profile.data.rating} · Отзывов {profile.data.reviewsCount} · Поездок{" "}
                  {profile.data.tripsCount}
                </p>
                <p className="ProfileHead__meta">
                  {profile.data.isVerified ? "Личность подтверждена Telegram" : "Личность не подтверждена"}
                </p>
                {profile.data.createdAt && (
                  <p className="ProfileHead__meta">
                    На сервисе с {new Date(profile.data.createdAt).getFullYear()}
                  </p>
                )}
                {profile.data.about && <p className="ProfileHead__about">{profile.data.about}</p>}
              </div>

              {editing ? (
                <>
                  <label className="FormField" htmlFor="profile-name">
                    Имя
                    <Input
                      id="profile-name"
                      value={name}
                      maxLength={100}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (formError) setFormError(null);
                      }}
                    />
                  </label>
                  <label className="FormField" htmlFor="profile-about">
                    О себе
                    <textarea
                      id="profile-about"
                      className="ProfileTextarea"
                      rows={3}
                      maxLength={500}
                      placeholder="Например: за рулём 7 лет, люблю музыку 80-х"
                      value={about}
                      onChange={(event) => {
                        setAbout(event.target.value);
                        if (formError) setFormError(null);
                      }}
                    />
                  </label>
                  {(formError || update.error) && (
                    <p className="FormError" role="alert">
                      {formError ?? (update.error instanceof Error ? update.error.message : "Не удалось сохранить")}
                    </p>
                  )}
                  <Button stretched loading={update.isPending} onClick={save}>
                    Сохранить изменения
                  </Button>
                  <Button mode="outline" stretched disabled={update.isPending} onClick={() => setEditing(false)}>
                    Отмена
                  </Button>
                </>
              ) : (
                <Button mode="outline" stretched onClick={startEditing}>
                  Редактировать
                </Button>
              )}

              <Button mode="outline" stretched onClick={() => navigate("/bookings")}>
                Мои брони
              </Button>
              <Button mode="outline" stretched onClick={() => navigate("/trips/my")}>
                Мои поездки
              </Button>
              <Button mode="outline" stretched onClick={() => navigate("/bookings/history")}>
                История поездок
              </Button>
              <Button mode="outline" stretched onClick={() => navigate("/reviews")}>
                Отзывы
              </Button>
              <Button mode="outline" stretched onClick={() => navigate("/notifications")}>
                Уведомления
              </Button>
              <Button mode="outline" stretched onClick={() => navigate("/profile/support")}>
                Поддержка
              </Button>
              <Button mode="outline" stretched onClick={() => navigate("/profile/reports")}>
                Жалобы
              </Button>

              <Button
                mode="outline"
                stretched
                loading={logout.isPending}
                disabled={logout.isPending}
                onClick={handleLogout}
              >
                Выйти
              </Button>
              {remove.error && (
                <p className="FormError" role="alert">
                  {remove.error instanceof ApiError &&
                  remove.error.code === "ACCOUNT_HAS_ACTIVE_OBLIGATIONS"
                    ? "Завершите активные поездки и отмените брони, затем повторите удаление."
                    : remove.error instanceof Error
                      ? remove.error.message
                      : "Не удалось удалить профиль"}
                </p>
              )}
              <Button
                mode="outline"
                stretched
                loading={remove.isPending}
                disabled={remove.isPending}
                onClick={handleDeleteAccount}
              >
                Удалить профиль
              </Button>
            </List>
          </Section>
        )}
      </QueryState>
    </>
  );
}
