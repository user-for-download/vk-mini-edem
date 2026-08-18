// mini-app/src/modals/CreateReviewModal/CreateReviewModal.tsx
import { type FC, useState, useCallback, useMemo } from "react";
import {
  Avatar,
  Button,
  Box,
  Caption,
  Flex,
  FormItem,
  ModalCard,
  Radio,
  Spacing,
  Text,
  Textarea,
  Title,
  Tappable,
} from "@vkontakte/vkui";
import { Icon16StarAlt } from "@vkontakte/icons";
import type { CustomModalProps, OpenModalCardProps } from "@vkontakte/vkui";
import type { Trip, User } from "@/types";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useCreateReviewMutation, REVIEW_KEYS } from "@/queries/useReviewsQuery";
import { useTripBookingsQuery } from "@/queries/useBookingsQuery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { resolveAvatar } from "@/helpers/avatar";
import { ApiError } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";

export type CreateReviewModalProps = CustomModalProps<
  OpenModalCardProps,
  { trip: Trip | null; target?: User | null }
>;

const MAX_TEXT_LENGTH = 1000;

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
            minWidth: 46,
            minHeight: 46,
          }}
        >
          <Icon16StarAlt width={30} height={30} aria-hidden="true" />
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
            title: "Отзыв отправлен",
            subtitle: "Спасибо, что помогаете делать сервис лучше",
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

  return (
    <ModalCard
      {...modalProps}
      title={targetUser?.name ? `Отзыв о ${targetUser.name}` : "Оставить отзыв"}
      description={
        trip ? `${trip.fromCity} → ${trip.toCity}, ${trip.date}` : undefined
      }
      actions={
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
      }
    >
      <Box padding="system" paddingBlockStart={0}>
        <Title level="3" weight="2">
          Как прошла поездка?
        </Title>

        {isDriver && passengers.length > 0 && (
          <>
            <Spacing size={12} />
            <FormItem top="Кому оставить отзыв">
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
            </FormItem>
          </>
        )}

        <Spacing size={16} />

        <StarPicker value={rating} onChange={setRating} />

        <Spacing size={8} />

        <FormItem
          top="Комментарий"
          status={validationError ? "error" : "default"}
          bottom={
            validationError ? (
              <Caption
                level="1"
                role="alert"
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
          <Caption
            level="1"
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
        )}

        <Text
          style={{
            color: "var(--vkui--color_text_secondary)",
            textAlign: "center",
          }}
        >
          Отзыв увидят другие пользователи сервиса
        </Text>
      </Box>
    </ModalCard>
  );
};
