// mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx
import { type FC, useEffect, useState } from "react";
import {
  Avatar,
  Button,
  ButtonGroup,
  Box,
  FormItem,
  FormStatus,
  Flex,
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  RichCell,
  ScreenSpinner,
  SegmentedControl,
  Separator,
  Spacing,
  Text,
  Textarea,
  Title,
  Card,
  Footnote,
  Subhead,
  ContentBadge,
} from "@vkontakte/vkui";
import { Icon16Favorite } from "@vkontakte/icons";
import type { Trip } from "@/types";
import { RouteLine } from "@/components/RouteLine";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { resolveAvatar } from "@/helpers/avatar";
import { getRateLimitMessage } from "@/helpers/errorMessages";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useCreateBookingMutation,
  useCancelBookingMutation,
  useTripBookingsQuery,
  useUpdateBookingStatusMutation,
} from "@/queries/useBookingsQuery";
import {
  useCancelTripMutation,
  useCompleteTripMutation,
  TRIP_KEYS,
} from "@/queries/useTripsQuery";
import { ApiError } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useModalApi } from "@/providers/ModalProvider";
import { BookingRequestRow } from "@/components/BookingRequestRow";
import { TripPassengerRow } from "@/components/TripPassengerRow";
import type { DriverBookingAction } from "@edem/contracts";
import { useConfirm } from "@/providers/ConfirmProvider";

export interface TripDetailsPanelProps {
  id: string;
  trip: Trip | null;
  onBack: () => void;
  onOpenDriver: () => void;
}

export const TripDetailsPanel: FC<TripDetailsPanelProps> = ({
  id,
  trip,
  onBack,
  onOpenDriver,
}) => {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  // Текущее время с периодическим обновлением: Date.now() в рендере запрещён
  // (react-hooks/purity), а кнопка «Завершить поездку» должна оживать после отправления.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [isCancellingTrip, setIsCancellingTrip] = useState(false);
  const [isCompletingTrip, setIsCompletingTrip] = useState(false);

  const { enqueue: enqueueSnackbar } = useSnackbar();
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const modalApi = useModalApi();
  const confirm = useConfirm();

  const createBooking = useCreateBookingMutation();
  const cancelBooking = useCancelBookingMutation();
  const cancelTrip = useCancelTripMutation();
  const completeTrip = useCompleteTripMutation();

  // Принадлежность поездки определяется ТОЛЬКО данными с сервера.
  // Клиентский role — это лишь переключатель вкладок и не должен
  // участвовать в проверках прав (иначе водитель, открывший свою поездку
  // в роли «пассажир», увидит кнопку бронирования своей же поездки).
  const isOwnTrip = !!currentUser && !!trip && trip.driver.id === currentUser.id;

  // Заявки на места видны только водителю поездки — пассажиру бэкенд
  // вернёт 403 (driver-only эндпоинт), поэтому запрос не делаем вовсе.
  const {
    data: tripBookingsData,
    isLoading: isLoadingBookings,
    isError: isErrorBookings,
    refetch: refetchBookings,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTripBookingsQuery(
    trip?.id ?? "",
    { enabled: isOwnTrip }
  );
  const updateBookingStatus = useUpdateBookingStatusMutation();

  const tripBookings = tripBookingsData?.pages.flatMap((page) => page.items) ?? [];
  const confirmedPassengers = tripBookings.filter(
    (booking) => booking.status === "confirmed"
  );
  const pendingBookings = tripBookings.filter(
    (booking) => booking.status === "pending"
  );

  const handleSetBookingStatus = async (bookingId: string, status: DriverBookingAction) => {
    try {
      await updateBookingStatus.mutateAsync({ id: bookingId, status });
      enqueueSnackbar({
        type: "success",
        title: status === "confirmed" ? "Заявка подтверждена" : "Заявка отклонена",
        dedupeKey: `booking_status_${bookingId}`,
      });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(id) });
    } catch (error) {
      enqueueSnackbar({
        type: "error",
        title: "Не удалось обновить статус",
        subtitle: error instanceof Error ? error.message : undefined,
        dedupeKey: `booking_status_error_${bookingId}`,
      });
    }
  };

  const cancelMyBooking = async (bookingId: string) => {
    const confirmed = await confirm({
      title: "Отменить бронирование?",
      description: "Заявка на поездку будет отменена, а место снова станет доступно.",
      confirmTitle: "Отменить бронь",
    });
    if (!confirmed) return;

    cancelBooking.mutate(bookingId, {
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Бронь отменена",
          dedupeKey: `cancel_booking_${bookingId}`,
        });
        queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(id) });
      },
      onError: (error) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось отменить бронь",
          subtitle: error instanceof Error ? error.message : undefined,
          dedupeKey: `cancel_booking_error_${bookingId}`,
        });
      },
    });
  };

  if (!trip) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={onBack} />}
        >
          Поездка
        </AppPanelHeader>
        <ScreenSpinner state="loading" />
      </Panel>
    );
  }

  const departureTime = trip.departureAt ? new Date(trip.departureAt).getTime() : null;
  const noSeats = trip.seatsAvailable <= 0;
  const hasActiveBooking = trip.myBooking && trip.myBooking.status !== "cancelled" && trip.myBooking.status !== "declined";

  const canBook =
    !isOwnTrip &&
    isTripActive(trip.status) &&
    !noSeats &&
    !hasActiveBooking &&
    departureTime !== null &&
    departureTime > now;

  function isTripActive(status?: string): boolean {
    return !status || status === "active";
  }

  const isTripActiveStatus = isTripActive(trip.status);
  const isTripCompleted = trip.status === "completed";
  const isTripCancelled = trip.status === "cancelled";

  const takenSeats = trip.bookedSeats ?? [];

  // Автоматически выбираем первое доступное место, если ничего не выбрано
  const availableSeats = Array.from({ length: trip.seatsTotal }, (_, i) => i + 1).filter(
    (seat) => !takenSeats.includes(seat)
  );

  const effectiveSelectedSeat = selectedSeat !== null && !takenSeats.includes(selectedSeat)
    ? selectedSeat
    : availableSeats[0] ?? null;

  const handleFooterClick = () => {
    if (!canBook) {
      return;
    }

    if (effectiveSelectedSeat === null) {
      return;
    }

    setIsSubmittingBooking(true);

    createBooking.mutate(
      {
        tripId: trip.id,
        seat: effectiveSelectedSeat,
        comment: comment.trim() ? comment.trim() : undefined,
      },
      {
        onSettled: () => {
          setIsSubmittingBooking(false);
        },
        onSuccess: () => {
          enqueueSnackbar({
            type: "success",
            title: "Забронировано",
            subtitle: "Ожидайте подтверждения от водителя",
            dedupeKey: `book_${trip.id}`,
          });
          onBack();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'SEAT_TAKEN') {
            enqueueSnackbar({
              type: "error",
              title: "Место уже занято",
              subtitle: "Пожалуйста, выберите другое место",
              dedupeKey: `book_error_${trip.id}`,
            });
            // Force refetch to update seat scheme
            queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(trip.id) });
          } else if (error instanceof ApiError && error.code === 'PASSENGER_BOOKING_OVERLAP') {
            enqueueSnackbar({
              type: "error",
              title: "Время пересекается с другой броней",
              subtitle: "У вас уже есть бронь на поездку в это время. Проверьте «Мои поездки».",
              dedupeKey: `book_overlap_error_${trip.id}`,
            });
          } else if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
            enqueueSnackbar({
              type: "error",
              title: getRateLimitMessage(error.retryAfterMs),
              dedupeKey: `book_rate_limit_error_${trip.id}`,
            });
          } else {
            enqueueSnackbar({
              type: "error",
              title: "Не удалось забронировать",
              subtitle: error instanceof Error ? error.message : undefined,
              dedupeKey: `book_error_${trip.id}`,
            });
          }
        },
      }
    );
  };

  const handleEditTrip = async () => {
    const { EditTripModal } = await import("@/modals/EditTripModal");
    modalApi.openCustomModalPage({
      component: EditTripModal,
      additionalProps: { trip },
      baseProps: { settlingHeight: 100 },
    });
  };

  const handleCancelTrip = async () => {
    if (!isOwnTrip || trip.status !== "active") {
      return;
    }

    const confirmed = await confirm({
      title: "Отменить поездку?",
      description: "Поездка станет недоступна, а пассажиры получат уведомление об отмене.",
      confirmTitle: "Отменить поездку",
    });
    if (!confirmed) return;

    setIsCancellingTrip(true);

    cancelTrip.mutate(trip.id, {
      onSettled: () => {
        setIsCancellingTrip(false);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Поездка отменена",
          subtitle: "Пассажиры получат уведомление",
          dedupeKey: `cancel_trip_${trip.id}`,
        });
        onBack();
      },
      onError: (error) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось отменить поездку",
          subtitle: error instanceof Error ? error.message : undefined,
          dedupeKey: `cancel_trip_error_${trip.id}`,
        });
      },
    });
  };

  const handleCompleteTrip = async () => {
    if (!canCompleteTrip) {
      return;
    }

    const confirmed = await confirm({
      title: "Завершить поездку?",
      description: "Поездка будет перенесена в архив, а пассажиры смогут оставить отзывы.",
      confirmTitle: "Завершить",
      confirmMode: "default",
    });
    if (!confirmed) return;

    setIsCompletingTrip(true);

    completeTrip.mutate(trip.id, {
      onSettled: () => {
        setIsCompletingTrip(false);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Поездка завершена",
          subtitle: "Теперь пассажиры могут оставить отзывы",
          dedupeKey: `complete_trip_${trip.id}`,
        });
        onBack();
      },
      onError: (error) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось завершить поездку",
          subtitle: error instanceof Error ? error.message : undefined,
          dedupeKey: `complete_trip_error_${trip.id}`,
        });
      },
    });
  };

  const canCompleteTrip =
    isOwnTrip &&
    isTripActiveStatus &&
    departureTime !== null &&
    departureTime <= now;

  const driver = trip.driver;
  const car = driver?.car;
  const carText = car ? [car.model, car.plate].filter(Boolean).join(" · ") : undefined;

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} />}
      >
        Детали поездки
      </AppPanelHeader>

      <Box padding="system">
        <Card mode="outline" // eslint-disable-next-line react/forbid-dom-props
        style={{ borderRadius: 12, backgroundColor: "var(--vkui--color_background_content)", overflow: "hidden" }}>
          <Box padding={16}>
            <RouteLine
              from={{ city: trip.fromCity, address: trip.fromAddress }}
              to={{ city: trip.toCity, address: trip.toAddress }}
              dateLabel={trip.date}
              time={trip.time}
              price={trip.price}
              duration={formatDuration(trip.durationMinutes)}
              distance={trip.distanceKm ? `${trip.distanceKm} км` : undefined}
            />
          </Box>

          <Separator />

          <RichCell
            onClick={onOpenDriver}
            beforeAlign="center"
            afterAlign="center"
            contentAlign="center"
            before={
              <Avatar
                size={48}
                src={resolveAvatar(driver?.avatar)}
                initials={initialsOf(driver?.name || "Водитель")}
              />
            }
            subtitle={
              carText ? (
                <Footnote
                  // eslint-disable-next-line react/forbid-dom-props
                  style={{ color: "var(--vkui--color_text_tertiary)" }}
                >
                  {carText}
                </Footnote>
              ) : undefined
            }
            after={
              <Flex align="center" gap="2xs">
                <Icon16Favorite style={{ color: "var(--vkui--color_icon_accent_themed)" }} />
                <Footnote
                  weight="2"
                  // eslint-disable-next-line react/forbid-dom-props
                  style={{ color: "var(--vkui--color_text_primary)" }}
                >
                  {(driver?.rating ?? 5.0).toFixed(1)}
                </Footnote>
              </Flex>
            }
          >
            <Text
              weight="2"
              // eslint-disable-next-line react/forbid-dom-props
              style={{ color: "var(--vkui--color_text_primary)" }}
            >
              {driver?.name || "Водитель"}
            </Text>
          </RichCell>
        </Card>
      </Box>

      {trip.tags && trip.tags.length > 0 && (
        <Group header={<Header size="s">Особенности поездки</Header>}>
          <Box padding="system">
            <Flex gap="s" wrap="wrap">
              {trip.tags.map((tag) => (
                <ContentBadge
                  key={tag}
                  appearance="accent"
                  size="m"
                >
                  {tag}
                </ContentBadge>
              ))}
            </Flex>
          </Box>
        </Group>
      )}

      {hasActiveBooking && (
        <Box padding="system">
          <FormStatus
            mode={trip.myBooking?.status === "confirmed" ? "default" : "default"}
            title={
              trip.myBooking?.status === "confirmed"
                ? `Место №${trip.myBooking.seat} забронировано (Подтверждено)`
                : `Заявка на место №${trip.myBooking?.seat} отправлена (Ожидает подтверждения)`
            }
          >
            {trip.myBooking?.status === "confirmed"
              ? "Водитель подтвердил вашу бронь. Приятной поездки!"
              : "Ожидайте подтверждения от водителя."}
          </FormStatus>
          <Spacing size={12} />
          <Button
            size="m"
            mode="secondary"
            stretched
            onClick={() => cancelMyBooking(trip.myBooking!.id)}
          >
            Отменить бронирование
          </Button>
        </Box>
      )}

      {isOwnTrip && (
        <Group header={<Header size="s">Управление заявками ({pendingBookings.length})</Header>}>
          {confirmedPassengers.length > 0 && (
            <Box padding="system">
              <Subhead weight="2" // eslint-disable-next-line react/forbid-dom-props
              style={{ color: "var(--vkui--color_text_secondary)" }}>
                Подтвержденные пассажиры ({confirmedPassengers.length})
              </Subhead>
              <Spacing size={8} />
              {confirmedPassengers.map((booking) => (
                <TripPassengerRow
                  key={booking.id}
                  booking={booking}
                />
              ))}
            </Box>
          )}

           {isErrorBookings && (
             <Box padding="system">
               <Text>Не удалось загрузить заявки.</Text>
               <Button size="m" mode="secondary" onClick={() => refetchBookings()}>Попробовать снова</Button>
             </Box>
           )}

           {!isLoadingBookings && !isErrorBookings && pendingBookings.length === 0 && confirmedPassengers.length === 0 && (
            <Box padding="system">
              <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
                Пока нет заявок на эту поездку
              </Text>
            </Box>
          )}

           {!isLoadingBookings && !isErrorBookings && pendingBookings.length > 0 && (
             <Box aria-live="polite" aria-label={`Список заявок, ${pendingBookings.length}`}>
              {pendingBookings.map((booking) => (
                <BookingRequestRow
                  key={booking.id}
                  booking={booking}
                  onSetStatus={handleSetBookingStatus}
                />
              ))}
              {hasNextPage && (
                <Box padding="system">
                  <Button size="m" mode="secondary" stretched onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                    Загрузить ещё
                  </Button>
                </Box>
              )}
             </Box>
           )}

           {!isLoadingBookings && !isErrorBookings && hasNextPage && pendingBookings.length === 0 && (
             <Box padding="system">
               <Button
                 size="m"
                 mode="secondary"
                 stretched
                 onClick={() => fetchNextPage()}
                 loading={isFetchingNextPage}
               >
                 Загрузить ещё
               </Button>
             </Box>
           )}
         </Group>
       )}

      {canBook && (
        <>
          <Group header={<Header size="s">Выберите место</Header>}>
            <Box padding="system">
              {(() => {
                if (availableSeats.length === 0) {
                  return <Text style={{ color: "var(--vkui--color_text_secondary)" }}>Все места заняты</Text>;
                }

                const options = Array.from({ length: trip.seatsTotal }, (_, i) => i + 1).map((seat) => {
                  const isTaken = takenSeats.includes(seat);
                  return {
                    label: isTaken ? `${seat} (зан.)` : `Место ${seat}`,
                    value: seat,
                    disabled: isTaken,
                  };
                });

                return (
                  <SegmentedControl<number>
                    value={effectiveSelectedSeat ?? availableSeats[0]}
                    onChange={(val) => setSelectedSeat(val)}
                    options={options}
                  />
                );
              })()}
            </Box>
          </Group>

          <Group header={<Header size="s">Комментарий водителю</Header>}>
            <FormItem>
              <Textarea
                placeholder="Например: буду с небольшим чемоданом, подойду к 9:25"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </FormItem>
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

            <Flex justify="space-between">
              <Text weight="2">Итого</Text>
              <Title level="3" weight="2">
                {trip.price.toLocaleString("ru-RU")} ₽
              </Title>
            </Flex>

            <Spacing size={12} />

            <Button
              size="l"
              stretched
              mode="primary"
              disabled={effectiveSelectedSeat === null}
              loading={isSubmittingBooking}
              onClick={handleFooterClick}
            >
              {effectiveSelectedSeat !== null
                ? `Забронировать · ${trip.price.toLocaleString("ru-RU")} ₽`
                : "Забронировать"}
            </Button>
          </Box>
        </>
      )}

      {isOwnTrip && (
        <Box padding="system">
          {isTripCompleted && (
            <FormStatus mode="default" title="Поездка завершена">
              Пассажиры могут оставить отзыв о поездке.
            </FormStatus>
          )}

          {isTripCancelled && (
            <FormStatus mode="default" title="Поездка отменена">
              Эта поездка больше недоступна для бронирования.
            </FormStatus>
          )}

          {isTripActiveStatus && (
            <>
              <FormStatus mode="default" title="Это ваша поездка">
                Заявками пассажиров можно управлять на вкладке «Поездки» → «Мои
                поездки».
              </FormStatus>

              <Spacing size={16} />

              <ButtonGroup mode="vertical" gap="m" stretched>
                <Button
                  size="m"
                  mode="secondary"
                  stretched
                  disabled={isCancellingTrip || isCompletingTrip}
                  onClick={handleEditTrip}
                >
                  Редактировать поездку
                </Button>

                <Button
                  size="m"
                  mode="primary"
                  stretched
                  loading={isCompletingTrip}
                  disabled={!canCompleteTrip || isCompletingTrip || isCancellingTrip}
                  onClick={handleCompleteTrip}
                >
                  Завершить поездку
                </Button>

                <Button
                  size="m"
                  mode="secondary"
                  stretched
                  loading={isCancellingTrip}
                  disabled={isCancellingTrip || isCompletingTrip}
                  onClick={handleCancelTrip}
                  // eslint-disable-next-line react/forbid-dom-props
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  Отменить поездку
                </Button>
              </ButtonGroup>
            </>
          )}
        </Box>
      )}

      <Spacing size={32} />
    </Panel>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} ч ${m} мин`;
  if (h > 0) return `${h} ч`;
  return `${m} мин`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || "ЭД";
}
