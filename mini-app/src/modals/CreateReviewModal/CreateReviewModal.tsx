// mini-app/src/modals/CreateReviewModal/CreateReviewModal.tsx
import { type FC, useState, useCallback } from "react";
import {
  Button,
  Box,
  Caption,
  FormItem,
  ModalCard,
  Text,
  Textarea,
  Title,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalCardProps } from "@vkontakte/vkui";
import type { Trip, User, Role } from "@/types";
import { useSnackbarStore } from "@/store/useSnackbarStore";
import { useCreateReviewMutation, REVIEW_KEYS } from "@/queries/useReviewsQuery";
import { ApiError } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";

export interface CreateReviewModalProps
  extends CustomModalProps<
    OpenModalCardProps,
    { trip: Trip | null; target?: User | null; targetRole?: Role | null }
  > {}

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
    <div
      style={{ display: "flex", gap: 8, justifyContent: "center" }}
      role="radiogroup"
      aria-label="Оценка поездки от 1 до 5"
      onKeyDown={handleKeyDown}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} из 5`}
          tabIndex={n === value ? 0 : -1}
          onClick={() => onChange(n)}
          style={{
            background: "none",
            border: "none",
            padding: 4,
            cursor: "pointer",
            outlineOffset: 2,
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 16 16"
            fill={n <= value ? "var(--carpool_accent)" : "none"}
            stroke="var(--carpool_accent)"
            strokeWidth="1"
            aria-hidden="true"
          >
            <path d="M8 1.2l1.98 4.28 4.62.56-3.42 3.24.9 4.72L8 11.7l-4.08 2.3.9-4.72L1.4 6.04l4.62-.56L8 1.2z" />
          </svg>
        </button>
      ))}
    </div>
  );
};

export const CreateReviewModal: FC<CreateReviewModalProps> = ({
  modalProps,
  close,
  trip,
  target,
  targetRole,
}) => {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);
  const createReview = useCreateReviewMutation();
  const queryClient = useQueryClient();

  const targetUser = target ?? trip?.driver ?? null;

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
      <Box padding="system" style={{ paddingTop: 0 }}>
        <Title
          level="3"
          weight="2"
          style={{ textAlign: "center", marginBottom: 16 }}
        >
          Как прошла поездка?
        </Title>

        <StarPicker value={rating} onChange={setRating} />

        <FormItem
          top="Комментарий"
          style={{ marginTop: 8 }}
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
              color:
                text.length > MAX_TEXT_LENGTH - 50
                  ? "var(--vkui--color_text_negative)"
                  : "var(--vkui--color_text_secondary)",
              textAlign: "right",
              marginBottom: 8,
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
