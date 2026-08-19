import type { FC } from "react";
import {
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  Paragraph,
} from "@vkontakte/vkui";
import { AppPanelHeader } from "@/components/AppPanelHeader";

export interface PrivacyPanelProps {
  id: string;
  onBack: () => void;
}

/**
 * Политика конфиденциальности.
 *
 * Важно: перед релизом текст нужно финализировать с юристом.
 */
export const PrivacyPanel: FC<PrivacyPanelProps> = ({ id, onBack }) => {
  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Политика конфиденциальности
      </AppPanelHeader>

      <Group header={<Header size="s">1. Какие данные мы используем</Header>}>
        <Paragraph>
          Для работы сервиса мы можем использовать данные профиля ВКонтакте:
          имя, фотографию, идентификатор пользователя, а также данные, которые
          пользователь указывает самостоятельно: сведения об автомобиле, отзывы,
          комментарии и настройки приложения.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">2. Зачем нужны эти данные</Header>}>
        <Paragraph>
          Данные используются для отображения профиля, организации поездок,
          бронирования мест, показа отзывов, повышения доверия между
          пользователями и улучшения работы сервиса.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">3. Что видят другие пользователи</Header>}>
        <Paragraph>
          Другие пользователи могут видеть имя, фотографию, рейтинг, отзывы,
          модель и цвет автомобиля. Госномер не публикуется в открытом профиле и
          поиске. Точные адреса сейчас не отображаются другим пользователям.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">4. Хранение и защита</Header>}>
        <Paragraph>
          Мы принимаем разумные технические и организационные меры для защиты
          данных пользователей и не передаем данные третьим лицам, за исключением
          случаев, предусмотренных законом.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">5. Права пользователя</Header>}>
        <Paragraph>
          Пользователь может запросить уточнение, исправление или удаление своих
          данных, обратившись в поддержку сервиса.
        </Paragraph>
      </Group>

      <Group header={<Header size="s">6. Обновление политики</Header>}>
        <Paragraph>
          Редакция от 19 августа 2026 года. Обновлённая редакция публикуется в
          этом разделе приложения до её применения.
        </Paragraph>
      </Group>
    </Panel>
  );
};
