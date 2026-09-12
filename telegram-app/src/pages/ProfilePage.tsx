import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Cell,
  Headline,
  Input,
  List,
  Placeholder,
  Section,
  SegmentedControl,
  Textarea,
} from "@telegram-apps/telegram-ui";
import {
  Bell,
  Car,
  ChevronRight,
  Flag,
  LogOut,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MutationError } from "@/components/MutationError";
import { QueryState } from "@/components/QueryState";
import { ReviewCard } from "@/components/ReviewCard";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useDeleteAccountMutation,
  useLogoutMutation,
  useProfileQuery,
  useProfileUpdateMutation,
} from "@/queries/profile";
import { useUserReviewsInfiniteQuery } from "@/queries/useReviewsQuery";
import { normalizeProfileForm, validateProfileForm } from "@/pages/profileValidation";
import { haptic } from "@/utils/haptics";
import { useModalBack } from "@/utils/modalBack";

type ProfileSubtab = "settings" | "reviews";

/**
 * Профиль Telegram-пользователя (язык ProfileTab примера): header-карточка
 * с рейтингом и статистикой, субтабы «Настройки и авто» / «Отзывы».
 *
 * Просмотр/редактирование имени и «О себе», переходы в разделы,
 * выход (POST /auth/logout + локальная очистка) и удаление аккаунта
 * (двойное подтверждение, обработка активных обязательств 409).
 * Бан/удаление mid-session: requireUser отвечает 403 — показываем
 * терминальные экраны вместо общей ошибки.
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const me = useAuthStore((state) => state.user);
  const profile = useProfileQuery();
  const update = useProfileUpdateMutation();
  const logout = useLogoutMutation();
  const remove = useDeleteAccountMutation();
  const aboutReviews = useUserReviewsInfiniteQuery(me?.id ?? "", 20);

  const [subtab, setSubtab] = useState<ProfileSubtab>("settings");
  const [editing, setEditing] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // State-модалка перехватывает Back первой (стек modalBack в Shell).
  useModalBack(() => setFeedbackOpen(false), feedbackOpen);

  useEffect(() => {
    if (profile.data && !editing) {
      setName(profile.data.name ?? "");
      setAbout(profile.data.about ?? "");
    }
  }, [profile.data, editing]);

  const aboutItems = useMemo(
    () => aboutReviews.data?.pages.flatMap((page) => page.items) ?? [],
    [aboutReviews.data],
  );

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

  const pickSubtab = (next: ProfileSubtab) => {
    if (next === subtab) return;
    haptic.selection();
    setSubtab(next);
  };

  return (
    <>
      <MutationError error={logout.error} />
      <QueryState
        loading={profile.isLoading}
        error={profile.error}
        empty={!profile.data}
        emptyText="Не удалось загрузить профиль."
        onRetry={() => void profile.refetch()}
      >
        {profile.data && (
          <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
            {/* Шапка профиля */}
            <div className="p-4 rounded-2xl bg-[var(--tgui--section_bg_color)] border border-[var(--tgui--outline)] shadow-xs flex flex-col gap-3">
              <div className="flex items-center gap-3.5">
                <Avatar
                  size={48}
                  src={profile.data.avatar}
                  acronym={(profile.data.name ?? "П").slice(0, 2).toUpperCase()}
                />
                <div className="flex-1 min-w-0">
                  <Headline weight="2" className="!text-[18px] truncate">
                    {profile.data.name}
                  </Headline>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--tgui--secondary_fill)] text-[var(--tgui--link_color)]">
                      <Star size={11} className="fill-[var(--app-rating)] text-[var(--app-rating)]" />
                      {`${profile.data.rating.toFixed(1)} (${profile.data.reviewsCount})`}
                    </span>
                    <span className="text-[11px] text-[var(--app-success)] font-medium">
                      Telegram верифицирован
                    </span>
                  </div>
                </div>
              </div>

              {profile.data.about && !editing && (
                <p className="text-[13px] text-[var(--tgui--text_color)] leading-relaxed">
                  {profile.data.about}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--tgui--outline)]">
                <div className="p-2 rounded-xl bg-[var(--tgui--tertiary_bg_color)] text-center">
                  <div className="text-[16px] font-bold text-[var(--tgui--text_color)]">
                    {profile.data.tripsCount}
                  </div>
                  <div className="text-[11px] text-[var(--tgui--hint_color)]">Поездок</div>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tgui--tertiary_bg_color)] text-center">
                  <div className="text-[16px] font-bold text-[var(--app-info)]">
                    {profile.data.reviewsCount}
                  </div>
                  <div className="text-[11px] text-[var(--tgui--hint_color)]">Отзывов</div>
                </div>
                <div className="p-2 rounded-xl bg-[var(--tgui--tertiary_bg_color)] text-center">
                  <div className="text-[16px] font-bold text-[var(--app-rating)]">
                    {profile.data.rating.toFixed(1)}
                  </div>
                  <div className="text-[11px] text-[var(--tgui--hint_color)]">Рейтинг</div>
                </div>
              </div>

              {editing ? (
                <>
                  <div className="FormField">
                    <label htmlFor="profile-name">Имя</label>
                    <Input
                      id="profile-name"
                      value={name}
                      maxLength={100}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (formError) setFormError(null);
                      }}
                    />
                  </div>
                  <div className="FormField">
                    <label htmlFor="profile-about">О себе</label>
                    <Textarea
                      id="profile-about"
                      rows={3}
                      maxLength={500}
                      placeholder="Например: за рулём 7 лет, люблю музыку 80-х"
                      value={about}
                      onChange={(event) => {
                        setAbout(event.target.value);
                        if (formError) setFormError(null);
                      }}
                    />
                  </div>
                  {(formError || update.error) && (
                    <p className="FormError" role="alert">
                      {formError ?? (update.error instanceof Error ? update.error.message : "Не удалось сохранить")}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button stretched size="s" loading={update.isPending} onClick={save}>
                      Сохранить изменения
                    </Button>
                    <Button mode="bezeled" size="s" stretched disabled={update.isPending} onClick={() => setEditing(false)}>
                      Отмена
                    </Button>
                  </div>
                </>
              ) : (
                subtab === "settings" && (
                  <Button mode="bezeled" stretched size="s" onClick={startEditing}>
                    Редактировать профиль
                  </Button>
                )
              )}
            </div>

            {/* Субтабы: Настройки и авто / Отзывы */}
            <div role="tablist" aria-label="Разделы профиля">
              <SegmentedControl>
                <SegmentedControl.Item
                  role="tab"
                  selected={subtab === "settings"}
                  aria-selected={subtab === "settings"}
                  onClick={() => pickSubtab("settings")}
                >
                  Настройки и авто
                </SegmentedControl.Item>
                <SegmentedControl.Item
                  role="tab"
                  selected={subtab === "reviews"}
                  aria-selected={subtab === "reviews"}
                  onClick={() => pickSubtab("reviews")}
                >
                  {`Отзывы (${profile.data.reviewsCount})`}
                </SegmentedControl.Item>
              </SegmentedControl>
            </div>

            {subtab === "settings" ? (
              <List className="!p-0 flex flex-col gap-3">
                <Section header="Мой автомобиль (для поездок)">
                  <Cell
                    Component="button"
                    before={
                      <span className="icon-circle icon-circle--info">
                        <Car size={20} />
                      </span>
                    }
                    subtitle={
                      profile.data.car
                        ? `${profile.data.car.model} · ${profile.data.car.color}`
                        : "Добавьте автомобиль, чтобы создавать поездки"
                    }
                    after={<ChevronRight size={16} className="text-[var(--tgui--hint_color)]" />}
                    onClick={() => navigate("/vehicle")}
                  >
                    {profile.data.car ? "Автомобиль" : "Добавить автомобиль"}
                  </Cell>
                </Section>

                <Section header="Уведомления">
                  <Cell
                    Component="button"
                    before={
                      <span className="icon-circle icon-circle--info">
                        <Bell size={18} />
                      </span>
                    }
                    subtitle={
                      profile.data.notificationsEnabled === false
                        ? "Некритичные уведомления выключены"
                        : "О новых бронях и подтверждении статуса"
                    }
                    after={<ChevronRight size={16} className="text-[var(--tgui--hint_color)]" />}
                    onClick={() => navigate("/settings")}
                  >
                    Настройки уведомлений
                  </Cell>
                  <Cell
                    Component="button"
                    before={
                      <span className="icon-circle icon-circle--success">
                        <Bell size={18} />
                      </span>
                    }
                    subtitle="Inbox заявок и статусов поездок"
                    after={<ChevronRight size={16} className="text-[var(--tgui--hint_color)]" />}
                    onClick={() => navigate("/notifications")}
                  >
                    Все уведомления
                  </Cell>
                </Section>

                <Section header="Сервис и помощь">
                  <Cell
                    Component="button"
                    before={
                      <span className="icon-circle icon-circle--purple">
                        <TriangleAlert size={18} />
                      </span>
                    }
                    subtitle="Вопросы и обращения — ответим в течение нескольких минут"
                    after={<ChevronRight size={16} className="text-[var(--tgui--hint_color)]" />}
                    onClick={() => {
                      haptic.light();
                      setFeedbackOpen(true);
                    }}
                  >
                    Служба поддержки
                  </Cell>
                  <Cell
                    Component="button"
                    before={
                      <span className="icon-circle icon-circle--danger">
                        <Flag size={18} />
                      </span>
                    }
                    subtitle="Сообщить о проблеме с пользователем"
                    after={<ChevronRight size={16} className="text-[var(--tgui--hint_color)]" />}
                    onClick={() => navigate("/profile/reports")}
                  >
                    Жалобы
                  </Cell>
                </Section>

                {/* Опасная зона */}
                <div className="p-4 rounded-2xl bg-[var(--tgui--section_bg_color)] border border-[var(--app-danger)]/30 shadow-xs flex flex-col gap-2">
                  <Button
                    mode="bezeled"
                    stretched
                    size="s"
                    before={<LogOut size={16} />}
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
                    mode="gray"
                    stretched
                    size="s"
                    before={<Trash2 size={16} />}
                    loading={remove.isPending}
                    disabled={remove.isPending}
                    onClick={handleDeleteAccount}
                  >
                    Удалить профиль
                  </Button>
                </div>
              </List>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl bg-[var(--tgui--section_bg_color)] border border-[var(--tgui--outline)] flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--tgui--hint_color)]">
                    Все отзывы проходят пре-модерацию
                  </span>
                  <Button size="s" mode="bezeled" onClick={() => navigate("/reviews")}>
                    Оставить отзыв
                  </Button>
                </div>

                <QueryState
                  loading={aboutReviews.isLoading}
                  error={aboutReviews.error}
                  empty={aboutItems.length === 0}
                  emptyText="После поездок пассажиры и водители смогут оценить вас — отзывы появятся здесь."
                  onRetry={() => void aboutReviews.refetch()}
                >
                  <div className="flex flex-col gap-3">
                    {aboutItems.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                    {aboutReviews.hasNextPage && (
                      <Button
                        mode="bezeled"
                        stretched
                        loading={aboutReviews.isFetchingNextPage}
                        disabled={aboutReviews.isFetchingNextPage}
                        onClick={() => void aboutReviews.fetchNextPage()}
                      >
                        Показать ещё
                      </Button>
                    )}
                  </div>
                </QueryState>
              </div>
            )}
          </div>
        )}
      </QueryState>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
