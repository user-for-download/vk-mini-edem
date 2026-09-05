import { type FC, useState } from "react";
import { Button, FormItem, Group, Header, ModalPage, ModalPageHeader, PanelHeaderButton, Select, Spacing, Textarea, Box, Caption } from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import type { ReportTargetType } from "@edem/contracts";
import { REPORT_CATEGORIES } from "@edem/contracts";
import { useCreateReportMutation } from "@/queries/useReportsQuery";
import { useSnackbar } from "@/providers/SnackbarProvider";

export interface ReportModalAdditionalProps { targetType: ReportTargetType; targetId: string; }
export type ReportModalProps = CustomModalProps<OpenModalPageProps, ReportModalAdditionalProps>;

const labels: Record<(typeof REPORT_CATEGORIES)[number], string> = { safety: "Безопасность", fraud: "Мошенничество", harassment: "Оскорбления", spam: "Спам", inaccurate_info: "Недостоверная информация", other: "Другое" };

export const ReportModal: FC<ReportModalProps> = ({ modalProps, close, targetType, targetId }) => {
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]>("safety");
  const [description, setDescription] = useState("");
  const create = useCreateReportMutation();
  const { enqueue } = useSnackbar();
  const submit = () => {
    const value = description.trim();
    if (!value) { enqueue({ type: "error", title: "Опишите проблему" }); return; }
    create.mutate({ targetType, targetId, category, description: value }, { onSuccess: () => { enqueue({ type: "success", title: "Жалоба отправлена" }); close(); }, onError: (error) => enqueue({ type: "error", title: error instanceof Error ? error.message : "Не удалось отправить жалобу" }) });
  };
  return <ModalPage {...modalProps} settlingHeight={100} header={<ModalPageHeader after={<PanelHeaderButton onClick={close} aria-label="Закрыть"><Icon24Cancel /></PanelHeaderButton>}>Пожаловаться</ModalPageHeader>}>
    <Group header={<Header size="s">Сообщите о проблеме</Header>}>
      <FormItem top="Причина"><Select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} options={REPORT_CATEGORIES.map((value) => ({ value, label: labels[value] }))} /></FormItem>
      <FormItem top="Описание"><Textarea value={description} maxLength={2000} placeholder="Опишите, что произошло" onChange={(event) => setDescription(event.target.value)} /></FormItem>
      <Box padding="system" paddingBlockStart={0}><Caption aria-live="polite">{description.length}/2000</Caption></Box>
    </Group>
    <Box padding="system"><Button size="l" stretched mode="primary" loading={create.isPending} disabled={create.isPending} onClick={submit}>Отправить жалобу</Button></Box>
    <Spacing size={24} />
  </ModalPage>;
};
