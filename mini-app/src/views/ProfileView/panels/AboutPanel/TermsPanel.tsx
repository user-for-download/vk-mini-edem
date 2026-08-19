import type { FC } from "react";
import {
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  Paragraph,
} from "@vkontakte/vkui";
import { AppPanelHeader } from "@/components/AppPanelHeader";

export interface TermsPanelProps {
  id: string;
  onBack: () => void;
}

/**
 * Пользовательское соглашение.
 *
 * Важно: перед релизом текст нужно финализировать с юристом.
 */
export const TermsPanel: FC<TermsPanelProps> = ({ id, onBack }) => {
  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Пользовательское соглашение
      </AppPanelHeader>

      <Group header={<Header size="s">1. Общие положения</Header>}>
        <Paragraph>
          Сервис «Едем» предоставляет пользователям платформу для поиска
          попутчиков и организации совместных поездок. Сервис не является
          перевозчиком и не предоставляет транспортные услуги напрямую.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">2. Обязанности пользователя</Header>}>
        <Paragraph>
          Пользователь обязуется указывать достоверную информацию, уважительно
          относиться к другим участникам поездок, не нарушать правила сервиса и
          действующее законодательство.
        </Paragraph>

        <Paragraph>
          Водитель несет ответственность за техническое состояние автомобиля,
          соблюдение ПДД и безопасность перевозки пассажиров.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">3. Бронирование и отмена</Header>}>
        <Paragraph>
          Заявка на поездку становится активной после подтверждения водителем.
          Пользователи должны своевременно уведомлять друг друга об отмене или
          изменении договоренностей.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">4. Оплата</Header>}>
        <Paragraph>
          Стоимость поездки определяется водителем и отображается в карточке
          поездки. Порядок расчетов между пользователями определяется ими
          самостоятельно, если иное не предусмотрено сервисом.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">5. Ограничение ответственности</Header>}>
        <Paragraph>
          Сервис предоставляет платформу «как есть» и не несет ответственности
          за действия пользователей, качество поездки, своевременность
          отправления и прибытия, а также за сохранность имущества, если иное
          не предусмотрено законом.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">6. Изменение условий</Header>}>
        <Paragraph>
          Редакция от 19 августа 2026 года. Обновлённые условия публикуются в
          приложении до их применения.
        </Paragraph>
      </Group>
    </Panel>
  );
};
