import { type FC, useState } from "react";
import {
  Button,
  FormItem,
  Group,
  Header,
  ModalPage,
  ModalPageHeader,
  PanelHeaderButton,
  Select,
  Spacing,
  Textarea,
  Box,
  Caption,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import type { ReportTargetType } from "@edem/contracts";
import { REPORT_CATEGORIES } from "@edem/contracts";
import { useCreateReportMutation, useMyReportsQuery } from "@/queries/useReportsQuery";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { ApiError } from "@/api/client";
import { getErrorMessage, getRateLimitMessage } from "@/helpers/errorMessages";

export interface ReportModalAdditionalProps {
  targetType: ReportTargetType;
  targetId: string;
}
export type ReportModalProps = CustomModalProps<
  OpenModalPageProps,
  ReportModalAdditionalProps
>;

const labels: Record<(typeof REPORT_CATEGORIES)[number], string> = {
  safety: "Безопасность",
  fraud: "Мошенничество",
  harassment: "Оскорбления",
  spam: "Спам",
  inaccurate_info: "Недостоверная информация",
  other: "Другое",
};

/**
 * Рантайм-гвард вместо cast: select возвращает произвольную строку из DOM
 * (audit: unchecked category cast). Неизвестное значение игнорируется.
 */
function isReportCategory(
  value: string,
): value is (typeof REPORT_CATEGORIES)[number] {
  return (REPORT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Маппинг ошибок отправки жалобы (зеркалит паттерн бронирования
 * в TripDetailsPanel): 409 CONFLICT — открытая жалоба на этот объект
 * уже существует, 429 RATE_LIMITED — лимит с учётом retryAfterMs,
 * 403 FORBIDDEN — нет связи с объектом (не участник поездки),
 * остальное — через общий словарь getErrorMessage.
 */
function reportSubmitError(error: unknown): {
  title: string;
  subtitle?: string;
} {
  if (
    error instanceof ApiError &&
    (error.status === 409 || error.code === "CONFLICT")
  ) {
    return {
      title: "Жалоба уже отправлена",
      subtitle:
        "Жалоба на этот объект уже отправлена. Повторная отправка недоступна.",
    };
  }
  if (
    error instanceof ApiError &&
    (error.status === 429 || error.code === "RATE_LIMITED")
  ) {
    return { title: getRateLimitMessage(error.retryAfterMs) };
  }
  if (
    error instanceof ApiError &&
    (error.status === 403 || error.code === "FORBIDDEN")
  ) {
    return {
      title: "Жалоба недоступна",
      subtitle:
        "Жалобы доступны участникам поездки — водителю и пассажирам с бронью.",
    };
  }
  if (error instanceof ApiError) {
    return {
      title: "Не удалось отправить жалобу",
      subtitle: getErrorMessage(error.code, error.message),
    };
  }
  return {
    title: "Не удалось отправить жалобу",
    subtitle: error instanceof Error ? error.message : undefined,
  };
}

export const ReportModal: FC<ReportModalProps> = ({
  modalProps,
  close,
  targetType,
  targetId,
}) => {
  const [category, setCategory] =
    useState<(typeof REPORT_CATEGORIES)[number]>("safety");
  const [description, setDescription] = useState("");
  const create = useCreateReportMutation();
  const { enqueue } = useSnackbar();
  // Клиентский хинт лимита «1 жалоба навсегда»: сервер — источник правды
  // (409), здесь лишь гасим кнопку, чтобы не гонять форму впустую.
  const { data: myReports } = useMyReportsQuery(true);
  const alreadyReported =
    myReports?.some(
      (report) => report.targetType === targetType && report.targetId === targetId,
    ) ?? false;
  const submit = () => {
    const value = description.trim();
    if (!value) {
      enqueue({ type: "error", title: "Опишите проблему" });
      return;
    }
    create.mutate(
      { targetType, targetId, category, description: value },
      {
        onSuccess: () => {
          enqueue({ type: "success", title: "Жалоба отправлена" });
          close();
        },
        onError: (error) =>
          enqueue({ type: "error", ...reportSubmitError(error) }),
      },
    );
  };
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
          Пожаловаться
        </ModalPageHeader>
      }
    >
      <Group header={<Header size="s">Сообщите о проблеме</Header>}>
        <FormItem top="Причина">
          <Select
            value={category}
            onChange={(event) => {
              const next = event.target.value;
              if (!isReportCategory(next)) return;
              setCategory(next);
            }}
            options={REPORT_CATEGORIES.map((value) => ({
              value,
              label: labels[value],
            }))}
          />
        </FormItem>
        <FormItem top="Описание">
          <Textarea
            value={description}
            maxLength={2000}
            placeholder="Опишите, что произошло"
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormItem>
        <Box padding="system" paddingBlockStart={0}>
          <Caption aria-live="polite">{description.length}/2000</Caption>
        </Box>
      </Group>
      <Box padding="system">
        {alreadyReported && (
          <Box paddingBlockEnd={8}>
            <Caption aria-live="polite">
              Вы уже отправляли жалобу на этот объект. Повторная отправка недоступна.
            </Caption>
          </Box>
        )}
        <Button
          size="l"
          stretched
          mode="primary"
          loading={create.isPending}
          disabled={create.isPending || alreadyReported}
          onClick={submit}
        >
          {alreadyReported ? "Жалоба уже отправлена" : "Отправить жалобу"}
        </Button>
      </Box>
      <Spacing size={24} />
    </ModalPage>
  );
};
