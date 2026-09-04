// mini-app/src/modals/CreateReviewModal/CreateReviewModal.tsx
import { type FC, useState, useCallback, useMemo } from "react";
import {
  Avatar,
  Button,
  Box,
  Caption,
  Flex,
  FormItem,
  Group,
  Header,
  ModalPage,
  ModalPageHeader,
  PanelHeaderButton,
  Radio,
  Separator,
  Spacing,
  Textarea,
  Tappable,
} from "@vkontakte/vkui";
import { Icon24Cancel, Icon24FavoriteOutline } from "@vkontakte/icons";
import { REVIEW_TEXT_MAX_LENGTH } from "@edem/contracts";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import type { Trip, User } from "@/types";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useCreateReviewMutation, REVIEW_KEYS } from "@/queries/useReviewsQuery";
import { useTripBookingsQuery } from "@/queries/useBookingsQuery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { resolveAvatar } from "@/helpers/avatar";
import { ApiError } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";

// Оформление — как у EditProfileModal/FeedbackModal (ModalPage, шапка,
// sticky-кнопка). Это последняя форма-модалка на старом ModalCard.
export type CreateReviewModalProps = CustomModalProps<
  OpenModalPageProps,
  { trip: Trip | null; target?: User | null }
>;

// Лимит длины текста отзыва — единая константа из @edem/contracts (запись
// и валидация на бэкенде используют то же значение, REVIEW_TEXT_MAX_LENGTH).
const MAX_TEXT_LENGTH = REVIEW_TEXT_MAX_LENGTH;

const StarPicker: FC<{ value: number; onChange: (v: number) => void }> = ({
  value,
  onChange,
}) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next = value;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          next = Math.min(5, value + 1);
          break;

        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          next = Math.max(1, value - 1);
          break;

        case "Home":
          e.preventDefault();
          next = 1;
          break;

        case "End":
          e.preventDefault();
          next = 5;
          break;

        default:
          return;
      }

      if (next !== value) onChange(next);
    },
    [value, onChange]
  );

  return (
    <Flex
      gap={8}
      justify="center"
      role="radiogroup"
      aria-label="Оценка поездки от 1 до 5"
      onKeyDown={handleKeyDown}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Tappable
          key={n}
          Component="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} из 5`}
          tabIndex={n === value ? 0 : -1}
          onClick={() => onChange(n)}
          // eslint-disable-next-line react/forbid-dom-props
          style={{
            color: n <= value ? "var(--vkui--color_icon_accent)" : "var(--vkui--color_icon_secondary)",
            border: "none",
            background: "transparent",
            minWidth: 46,
            minHeight: 46,
          }}
        >
          <Icon24FavoriteOutline width={30} height={30} aria-hidden="true" />
        </Tappable>
      ))}
    </Flex>
  );
};

export const CreateReviewModal: FC<CreateReviewModalProps> = ({
  modalProps,
  close,
  trip,
  target,
}) => {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { enqueue: enqueueSnackbar } = useSnackbar();
  const createReview = useCreateReviewMutation();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  // Водитель поездки отзывается о пассажирах: подгружаем подтверждённые
  // брони и даём выбрать, кому оставить отзыв.
  const isDriver = Boolean(
    trip && currentUser && trip.driver.id === currentUser.id
  );

  const { data: tripBookingsData } = useTripBookingsQuery(trip?.id ?? "", {
    enabled: isDriver,
  });

  const passengers = useMemo(() => {
    if (!isDriver) {
      return [];
    }
    const tripBookings = tripBookingsData?.pages.flatMap((page) => page.items) ?? [];
    return tripBookings
      .filter((b) => b.status === "confirmed")
      .map((b) => b.passenger);
  }, [isDriver, tripBookingsData]);

  const [selectedPassengerId, setSelectedPassengerId] = useState<string | null>(
    null
  );

  const targetUser = useMemo(() => {
    if (target) {
      return target;
    }
    if (isDriver) {
      return (
        passengers.find((p) => p.id === selectedPassengerId) ??
        passengers[0] ??
        null
      );
    }
    return trip?.driver ?? null;
  }, [target, isDriver, passengers, selectedPassengerId, trip]);

  const handleSubmit = () => {
    if (!trip) {
      setValidationError("Поездка не выбрана");
      return;
    }

    if (!targetUser?.id) {
      setValidationError("Не найден пользователь для отзыва");
      return;
    }

    const trimmedText = text.trim();

    if (!trimmedText) {
      setValidationError("Добавьте комментарий к отзыву");
      return;
    }

    if (trimmedText.length > MAX_TEXT_LENGTH) {
      setValidationError(`Максимум ${MAX_TEXT_LENGTH} символов`);
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    createReview.mutate(
      {
        tripId: trip.id,
        targetUserId: targetUser.id,
        rating,
        text: trimmedText,
      },
      {
        onSettled: () => {
          setIsSubmitting(false);
        },
        onSuccess: () => {
          enqueueSnackbar({
            type: "success",
            title: "Отзыв отправлен на модерацию",
            subtitle: "Он появится в профиле после одобрения",
            dedupeKey: "create_review_success",
          });

          setText("");
          setRating(5);
          close();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'ALREADY_REVIEWED') {
            enqueueSnackbar({
              type: "error",
              title: "Вы уже оставили отзыв",
              subtitle: "Нельзя оставить отзыв дважды",
              dedupeKey: "create_review_error",
            });
            queryClient.invalidateQueries({ queryKey: REVIEW_KEYS.availableTrips() });
            close();
          } else {
            enqueueSnackbar({
              type: "error",
              title: "Не удалось отправить отзыв",
              subtitle: error instanceof Error ? error.message : undefined,
              dedupeKey: "create_review_error",
            });
          }
        },
      }
    );
  };

  const handleTextChange = (value: string) => {
    setText(value);

    if (validationError) {
      setValidationError(null);
    }
  };

  const canSubmit =
    Boolean(trip) &&
    Boolean(targetUser?.id) &&
    text.trim().length > 0 &&
    !isSubmitting;

  const headerTitle = targetUser?.name
    ? `Отзыв о ${targetUser.name}`
    : "Оставить отзыв";

  return (
    <ModalPage
      {...modalProps}
      settlingHeight={100}
      header={
        <ModalPageHeader
          after={
            <PanelHeaderButton onClick={close} aria-label="Закрыть">
              <Icon24Cancel />
            </PanelHeaderButton>
          }
        >
          {headerTitle}
        </ModalPageHeader>
      }
    >
      <Group
        header={
          <Header size="s">
            Поездка
          </Header>
        }
      >
        <Box padding="system" paddingBlockStart={0}>
          <Caption
            level="1"
            // eslint-disable-next-line react/forbid-dom-props
            style={{ color: "var(--vkui--color_text_secondary)" }}
          >
            {trip
              ? `${trip.fromCity} → ${trip.toCity}, ${trip.date}`
              : "—"}
          </Caption>
        </Box>
      </Group>

      {isDriver && passengers.length > 0 && (
        <Group header={<Header size="s">Кому оставить отзыв</Header>}>
          <Flex direction="column" gap={4}>
            {passengers.map((passenger) => (
              <Radio
                key={passenger.id}
                name="review-target"
                checked={
                  selectedPassengerId === passenger.id ||
                  (selectedPassengerId === null &&
                    passengers[0]?.id === passenger.id)
                }
                onChange={() => setSelectedPassengerId(passenger.id)}
              >
                <Flex align="center" gap={8}>
                  <Avatar
                    src={resolveAvatar(passenger.avatar)}
                    size={32}
                  />
                  {passenger.name}
                </Flex>
              </Radio>
            ))}
          </Flex>
        </Group>
      )}

      <Group header={<Header size="s">Оценка</Header>}>
        <Box padding="system" paddingBlockStart={0}>
          <StarPicker value={rating} onChange={setRating} />
        </Box>
      </Group>

      <Group header={<Header size="s">Комментарий</Header>}>
        <FormItem
          status={validationError ? "error" : "default"}
          bottom={
            validationError ? (
              <Caption
                level="1"
                role="alert"
                // eslint-disable-next-line react/forbid-dom-props
                style={{ color: "var(--vkui--color_text_negative)" }}
              >
                {validationError}
              </Caption>
            ) : undefined
          }
        >
          <Textarea
            placeholder="Расскажите, что понравилось или что стоит улучшить"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            maxLength={MAX_TEXT_LENGTH}
            aria-invalid={Boolean(validationError)}
          />
        </FormItem>

        {text.length > 0 && (
          <Box padding="system" paddingBlockStart={0}>
            <Caption
              level="1"
              // eslint-disable-next-line react/forbid-dom-props
              style={{
                textAlign: "right",
                color:
                  text.length > MAX_TEXT_LENGTH - 50
                    ? "var(--vkui--color_text_negative)"
                    : "var(--vkui--color_text_secondary)",
              }}
              aria-live="polite"
            >
              {text.length}/{MAX_TEXT_LENGTH}
            </Caption>
          </Box>
        )}
      </Group>

      <Box
        padding="system"
        // eslint-disable-next-line react/forbid-dom-props
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--vkui--color_background_content)",
        }}
      >
        <Separator />

        <Spacing size={12} />

        <Button
          size="l"
          stretched
          mode="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        >
          Отправить отзыв
        </Button>
      </Box>
    </ModalPage>
  );
};
