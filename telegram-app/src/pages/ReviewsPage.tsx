import { useMemo, useRef, useState } from "react";
import { Button, List, Section } from "@telegram-apps/telegram-ui";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { ApiError } from "@/api/client";
import {
  REVIEW_STATUS,
  REVIEW_TEXT_MAX_LENGTH,
  type Review,
  type Trip,
  type User,
} from "@edem/contracts";
import type { MyReview } from "@/api/reviews.api";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfileQuery } from "@/queries/profile";
import {
  useAvailableReviewTripsQuery,
  useCreateReviewMutation,
  useMyReviewsQuery,
  useUserReviewsInfiniteQuery,
} from "@/queries/useReviewsQuery";
import { useTripBookingsQuery } from "@/queries/useBookingsQuery";
import {
  normalizeReviewText,
  validateReviewForm,
} from "@/pages/reviewValidation";

export type ReviewsTab = "mine" | "new" | "about";

const TABS: ReadonlyArray<{ value: ReviewsTab; label: string }> = [
  { value: "mine", label: "Мои" },
  { value: "new", label: "Новая" },
  { value: "about", label: "Обо мне" },
];

/** Подпись статуса — только для непубличных отзывов (порт VK ReviewCard). */
function statusBadge(status: Review["status"]): string | null {
  switch (status) {
    case REVIEW_STATUS.PENDING:
      return "На модерации";
    case REVIEW_STATUS.REJECTED:
      return "Отклонён";
    default:
      return null;
  }
}

function ReviewCard({ review }: { review: Review | MyReview }) {
  const badge = statusBadge(review.status);
  return (
    <article className="ReviewCard">
      <p className="ReviewCard__head">
        {review.author.name} · Оценка {review.rating}/5
        {badge && (
          <span className="ReviewCard__badge" data-status={review.status}>
            {" "}
            · {badge}
          </span>
        )}
      </p>
      <p className="ReviewCard__route">
        {review.tripRoute} · {review.date}
      </p>
      <p className="ReviewCard__text">{review.text}</p>
    </article>
  );
}

function tripLabel(trip: Trip): string {
  return `${trip.fromCity} → ${trip.toCity} · ${trip.date}`;
}

/**
 * Отзывы и рейтинг Telegram-пользователя (порт VK ReviewsPanel +
 * CreateReviewModal + SelectReviewTripModal).
 *
 * Вкладки:
 * - «Мои» — все мои отзывы (GET /reviews/my, все статусы: pending /
 *   published / rejected с подписями);
 * - «Новая» — доступные поездки (GET /reviews/available-trips) + форма
 *   создания отзыва в обе стороны (пассажир → водителю, водитель →
 *   пассажиру через подтверждённые брони);
 * - «Обо мне» — публичные отзывы (GET /reviews/user/:id отдаёт только
 *   published) + шапка рейтинга (агрегат считает только опубликованные).
 *
 * Валидация 150 символов: maxLength на textarea (браузер) + чистая
 * validateReviewForm (показ) + createReviewDtoSchema на записи (backend
 * отклоняет > 150 тем же лимитом REVIEW_TEXT_MAX_LENGTH).
 */
export function ReviewsPage({ initialTab = "mine" }: { initialTab?: ReviewsTab }) {
  const [tab, setTab] = useState<ReviewsTab>(initialTab);
  const me = useAuthStore((state) => state.user);

  const my = useMyReviewsQuery();
  const available = useAvailableReviewTripsQuery();
  const profile = useProfileQuery();
  const about = useUserReviewsInfiniteQuery(me?.id ?? "", 20);
  const create = useCreateReviewMutation();

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedPassengerId, setSelectedPassengerId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Защита от двойного сабмита: ref синхронен (в отличие от state),
  // второй клик до ре-рендера не отправит второй запрос (паттерн VK).
  const submitGuard = useRef(false);

  const trips = useMemo(() => available.data ?? [], [available.data]);
  const selectedTrip: Trip | null =
    trips.find((trip) => trip.id === selectedTripId) ?? trips[0] ?? null;

  const isDriverTrip = Boolean(
    me && selectedTrip && selectedTrip.driver.id === me.id,
  );

  // Водитель отзывается о пассажирах: цели — подтверждённые брони поездки
  // (useTripBookingsQuery — infinite, сплющиваем страницы; зеркально VK).
  const tripBookings = useTripBookingsQuery(selectedTrip?.id ?? "", {
    enabled: Boolean(selectedTrip) && isDriverTrip,
  });
  const passengers: User[] = useMemo(() => {
    if (!isDriverTrip) return [];
    const seen = new Map<string, User>();
    for (const page of tripBookings.data?.pages ?? []) {
      for (const booking of page.items) {
        if (booking.status === "confirmed" && !seen.has(booking.passenger.id)) {
          seen.set(booking.passenger.id, booking.passenger);
        }
      }
    }
    return [...seen.values()];
  }, [isDriverTrip, tripBookings.data]);

  // Цель отзыва: пассажир всегда пишет водителю; водитель выбирает
  // пассажира (явный выбор > первый в списке — паттерн VK).
  const targetUser: User | null = isDriverTrip
    ? (passengers.find((p) => p.id === selectedPassengerId) ??
      passengers[0] ??
      null)
    : (selectedTrip?.driver ?? null);

  const aboutItems = useMemo(
    () => about.data?.pages.flatMap((page) => page.items) ?? [],
    [about.data],
  );

  const pickTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    setSelectedPassengerId(null);
    setFormError(null);
    setSuccess(false);
  };

  const submit = () => {
    if (create.isPending || submitGuard.current) return;

    if (!selectedTrip) {
      setFormError("Выберите поездку");
      return;
    }
    if (!targetUser) {
      setFormError("Не найден пользователь для отзыва");
      return;
    }
    const validationError = validateReviewForm(text);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    setSuccess(false);
    submitGuard.current = true;
    create.mutate(
      {
        tripId: selectedTrip.id,
        targetUserId: targetUser.id,
        rating,
        text: normalizeReviewText(text),
      },
      {
        onSettled: () => {
          submitGuard.current = false;
        },
        onSuccess: () => {
          setText("");
          setRating(5);
          setSuccess(true);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "ALREADY_REVIEWED") {
            setFormError("Вы уже оставили отзыв об этом пользователе в этой поездке");
          } else if (error instanceof ApiError && error.code === "CONFLICT") {
            setFormError("Конфликт параллельной записи — повторите попытку");
          } else {
            setFormError(
              error instanceof Error ? error.message : "Не удалось отправить отзыв",
            );
          }
        },
      },
    );
  };

  const canSubmit =
    Boolean(selectedTrip) &&
    Boolean(targetUser) &&
    text.trim().length > 0 &&
    !create.isPending;

  return (
    <>
      <PageHeader title="Отзывы" />
      <div className="ReviewTabs" role="group" aria-label="Разделы отзывов">
        {TABS.map((option) => (
          <Button
            key={option.value}
            size="s"
            mode={tab === option.value ? "filled" : "outline"}
            aria-pressed={tab === option.value}
            onClick={() => setTab(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {tab === "mine" && (
        <QueryState
          loading={my.isLoading}
          error={my.error}
          empty={false}
          emptyText=""
          onRetry={() => void my.refetch()}
        >
          {!my.data || my.data.length === 0 ? (
            <Section>
              <p className="ReviewEmpty__title">Вы пока не оставили отзывов</p>
              <p className="ReviewEmpty__subtitle">
                Оставьте отзыв о поездке — это поможет другим выбрать маршрут
              </p>
              <div className="ButtonRow">
                <Button stretched onClick={() => setTab("new")}>
                  Оставить отзыв
                </Button>
              </div>
            </Section>
          ) : (
            <Section>
              <List>
                {my.data.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </List>
            </Section>
          )}
        </QueryState>
      )}

      {tab === "new" && (
        <QueryState
          loading={available.isLoading}
          error={available.error}
          empty={false}
          emptyText=""
          onRetry={() => void available.refetch()}
        >
          {trips.length === 0 || !selectedTrip ? (
            <Section>
              <p className="ReviewEmpty__title">Пока нет поездок для отзыва</p>
              <p className="ReviewEmpty__subtitle">
                Когда вы совершите поездку, она появится здесь
              </p>
            </Section>
          ) : (
            <Section>
              <List>
                <label className="FormField" htmlFor="review-trip">
                  Поездка
                  <select
                    id="review-trip"
                    className="ReviewSelect"
                    value={selectedTrip.id}
                    onChange={(event) => pickTrip(event.target.value)}
                  >
                    {trips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {tripLabel(trip)}
                      </option>
                    ))}
                  </select>
                </label>

                {isDriverTrip ? (
                  <label className="FormField" htmlFor="review-target">
                    Кому оставить отзыв
                    <select
                      id="review-target"
                      className="ReviewSelect"
                      value={targetUser?.id ?? ""}
                      onChange={(event) => {
                        setSelectedPassengerId(event.target.value);
                        if (formError) setFormError(null);
                      }}
                    >
                      {passengers.map((passenger) => (
                        <option key={passenger.id} value={passenger.id}>
                          {passenger.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="ReviewTarget">
                    Отзыв о {targetUser?.name ?? "водителе"}
                  </p>
                )}

                <div className="FormField">
                  <span id="review-rating-label">Оценка</span>
                  <div
                    role="radiogroup"
                    aria-labelledby="review-rating-label"
                    className="ReviewStars"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={n === rating}
                        aria-label={`${n} из 5`}
                        className="ReviewStars__star"
                        data-active={n <= rating}
                        onClick={() => setRating(n)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <label className="FormField" htmlFor="review-text">
                  Комментарий
                  <textarea
                    id="review-text"
                    className="ProfileTextarea"
                    rows={3}
                    maxLength={REVIEW_TEXT_MAX_LENGTH}
                    placeholder="Расскажите, что понравилось или что стоит улучшить"
                    value={text}
                    aria-invalid={Boolean(formError)}
                    onChange={(event) => {
                      setText(event.target.value);
                      if (formError) setFormError(null);
                      if (success) setSuccess(false);
                    }}
                  />
                </label>
                {text.length > 0 && (
                  <p className="ReviewCounter" aria-live="polite">
                    {text.length}/{REVIEW_TEXT_MAX_LENGTH}
                  </p>
                )}

                {formError && (
                  <p className="FormError" role="alert">
                    {formError}
                  </p>
                )}
                {success && (
                  <p className="ReviewSuccess" role="status">
                    Отзыв отправлен на модерацию — он появится в профиле после одобрения
                  </p>
                )}
                <div className="ButtonRow">
                  <Button
                    stretched
                    loading={create.isPending}
                    disabled={!canSubmit}
                    onClick={submit}
                  >
                    Отправить отзыв
                  </Button>
                </div>
              </List>
            </Section>
          )}
        </QueryState>
      )}

      {tab === "about" && (
        <QueryState
          loading={profile.isLoading || about.isLoading}
          error={profile.error ?? about.error}
          empty={false}
          emptyText=""
          onRetry={() => {
            void profile.refetch();
            void about.refetch();
          }}
        >
          {profile.data && (
            <Section>
              <p className="ReviewRating">
                Рейтинг {profile.data.rating.toFixed(1)} · {profile.data.reviewsCount}{" "}
                отзывов
              </p>
              <p className="ReviewRating__hint">
                Рейтинг учитывает только опубликованные отзывы
              </p>
            </Section>
          )}
          {aboutItems.length === 0 ? (
            <Section>
              <p className="ReviewEmpty__title">О вас пока нет отзывов</p>
              <p className="ReviewEmpty__subtitle">
                После поездок пассажиры и водители смогут оценить вас — отзывы появятся
                здесь
              </p>
            </Section>
          ) : (
            <Section>
              <List>
                {aboutItems.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </List>
              {about.hasNextPage && (
                <div className="ButtonRow">
                  <Button
                    mode="outline"
                    stretched
                    loading={about.isFetchingNextPage}
                    disabled={about.isFetchingNextPage}
                    onClick={() => void about.fetchNextPage()}
                  >
                    Показать ещё
                  </Button>
                </div>
              )}
            </Section>
          )}
        </QueryState>
      )}
    </>
  );
}
