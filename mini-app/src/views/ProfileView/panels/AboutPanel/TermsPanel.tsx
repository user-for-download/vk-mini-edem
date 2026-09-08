import type { FC } from "react";
import {
  Box,
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
 * Важно: перед релизом текст нужно финализировать с юристом и заполнить
 * плейсхолдеры реквизитов оператора (раздел 1) — тексты в квадратных
 * скобках.
 */
export const TermsPanel: FC<TermsPanelProps> = ({ id, onBack }) => {
  return (
    <Panel id={id}>
      <AppPanelHeader before={<PanelHeaderBack onClick={onBack} />}>
        Пользовательское соглашение
      </AppPanelHeader>

      <Group header={<Header size="s">1. Общие положения</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Сервис «Едем» (далее — Сервис) предоставляет пользователям платформу
            для поиска попутчиков и организации совместных поездок. Сервис не
            является перевозчиком и не предоставляет транспортные услуги
            напрямую. Оператор Сервиса: [НАИМЕНОВАНИЕ ОРГАНИЗАЦИИ/ИП], адрес:
            [ЮРИДИЧЕСКИЙ АДРЕС], контакт: [E-MAIL].
          </Paragraph>
        </Box>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Сервис предназначен для лиц старше 14 лет. Использование Сервиса
            означает согласие с настоящим Соглашением и Политикой
            конфиденциальности, а также с правилами ВКонтакте.
          </Paragraph>
        </Box>
      </Group>

      <Group header={<Header size="s">2. Обязанности пользователя</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Пользователь обязуется указывать достоверную информацию, уважительно
            относиться к другим участникам поездок, не нарушать правила сервиса
            и действующее законодательство.
          </Paragraph>
        </Box>

        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Водитель несет ответственность за техническое состояние автомобиля,
            соблюдение ПДД и безопасность перевозки пассажиров.
          </Paragraph>
        </Box>
      </Group>

      <Group header={<Header size="s">3. Бронирование и отмена</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Заявка на поездку становится активной после подтверждения водителем.
            Пользователи должны своевременно уведомлять друг друга об отмене или
            изменении договоренностей.
          </Paragraph>
        </Box>
      </Group>

      <Group header={<Header size="s">4. Оплата</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Стоимость поездки определяется водителем и отображается в карточке
            поездки. Порядок расчетов между пользователями определяется ими
            самостоятельно. Сервис не участвует в расчетах, не принимает платежи
            и не взимает комиссию.
          </Paragraph>
        </Box>
      </Group>

      <Group header={<Header size="s">5. Модерация и блокировка</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Отзывы публикуются после модерации. За нарушение правил Сервиса или
            законодательства аккаунт может быть заблокирован с указанием
            причины. Пользователь вправе обжаловать блокировку: обращение
            отправляется с экрана блокировки и рассматривается поддержкой; если
            блокировка будет снята, ответ будет доступен в приложении в разделе
            «Мои обращения».
          </Paragraph>
        </Box>
      </Group>

      <Group header={<Header size="s">6. Ограничение ответственности</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Сервис предоставляет платформу «как есть» и не несет ответственности
            за действия пользователей, качество поездки, своевременность
            отправления и прибытия, а также за сохранность имущества, если иное
            не предусмотрено законом.
          </Paragraph>
        </Box>
      </Group>

      <Group header={<Header size="s">7. Применимое право и споры</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            К настоящему Соглашению применяется право Российской Федерации.
            Претензии направляются оператору через поддержку Сервиса (Профиль →
            Помощь и поддержка) или по адресу [E-MAIL]. Спор, не урегулированный
            в претензионном порядке, рассматривается судом по месту нахождения
            оператора.
          </Paragraph>
        </Box>
      </Group>

      <Group header={<Header size="s">8. Изменение условий</Header>}>
        <Box paddingInline="2xl" paddingBlock="1rem">
          <Paragraph normalize align="start">
            Редакция от 8 сентября 2026 года. Обновлённые условия публикуются в
            приложении не позднее чем за 7 дней до их применения; дальнейшее
            использование Сервиса означает согласие с обновлённой редакцией.
          </Paragraph>
        </Box>
      </Group>
    </Panel>
  );
};
