import type { FC } from "react";
import {
  Footer,
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  SimpleCell,
} from "@vkontakte/vkui";
import { useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { AppPanelHeader } from "@/components/AppPanelHeader";

export interface AboutPanelProps {
  id: string;
  onBack: () => void;
}

const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.0";

/**
 * О сервисе:
 * - версия из сборки;
 * - реальные переходы к юр. документам.
 */
export const AboutPanel: FC<AboutPanelProps> = ({ id, onBack }) => {
  const routeNavigator = useRouteNavigator();

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        О сервисе
      </AppPanelHeader>

      <Group mode="plain">
        <SimpleCell indicator={APP_VERSION}>Версия приложения</SimpleCell>
        <SimpleCell indicator="Русский">Язык приложения</SimpleCell>

        <Footer Component="div">
          «Едем» — сервис совместных поездок. Все права защищены.
        </Footer>
      </Group>

      <Group header={<Header size="s">Документы</Header>}>
        <SimpleCell
          chevron="always"
          onClick={() => routeNavigator.push("/profile/about/terms")}
        >
          Пользовательское соглашение
        </SimpleCell>

        <SimpleCell
          chevron="always"
          onClick={() => routeNavigator.push("/profile/about/privacy")}
        >
          Политика конфиденциальности
        </SimpleCell>
      </Group>
    </Panel>
  );
};
