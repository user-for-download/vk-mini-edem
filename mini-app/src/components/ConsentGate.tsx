// mini-app/src/components/ConsentGate.tsx
//
// Блокирующий экран первого входа: акцепт Пользовательского соглашения и
// Политики конфиденциальности (152-ФЗ). Показывается вместо приложения,
// пока пользователь с текущей версией онбординга не нажал «Принять»:
// навигация, WS и API-активность до согласия недоступны.
//
// Согласие фиксируется на бэкенде тем же механизмом, что и онбординг:
// POST /users/me/onboarding с ONBOARDING_VERSION — кнопка «Принять»
// единственный путь сохранения версии (просмотр/пропуск слайдов не
// считается). Сброс онбординга из админки возвращает пользователя на
// этот экран (повторный акцепт новой редакции документов).
//
// Слайды онбординга (VKWebAppShowSlidesSheet) показываются поверх экрана
// согласия — логика перенесена из useOnboarding (App монтируется только
// после акцепта, поэтому хук там больше не живёт).
import {
  type FC,
  type PropsWithChildren,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Caption,
  Group,
  Header,
  Panel,
  PanelSpinner,
  Placeholder,
  SimpleCell,
  View,
} from "@vkontakte/vkui";
import { Icon56CheckCircleOutline } from "@vkontakte/icons";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthStore } from "@/store/useAuthStore";
import { usersApi } from "@/api/users.api";
import { showSlidesSheet } from "@/helpers/bridge";
import { loadLazyModule } from "@/helpers/loadModule";
import { ONBOARDING_VERSION, shouldShowOnboarding } from "@/onboarding/version";

const TermsPanel = lazy(() =>
  loadLazyModule(
    () => import("@/views/ProfileView/panels/AboutPanel/TermsPanel"),
  ).then((m) => ({
    default: m.TermsPanel,
  })),
);
const PrivacyPanel = lazy(() =>
  loadLazyModule(
    () => import("@/views/ProfileView/panels/AboutPanel/PrivacyPanel"),
  ).then((m) => ({
    default: m.PrivacyPanel,
  })),
);

const PANEL_CONSENT = "consent";
const PANEL_TERMS = "terms";
const PANEL_PRIVACY = "privacy";

// Защита от повторного показа слайдов: StrictMode дублирует эффекты в dev,
// плюс слайды не должны показываться дважды за сессию.
let slidesTriggered = false;

export const ConsentGate: FC<PropsWithChildren> = ({ children }) => {
  const user = useCurrentUser();
  const [activePanel, setActivePanel] = useState(PANEL_CONSENT);
  const [declined, setDeclined] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Защита от двойного сабмита: ref синхронен (в отличие от state),
  // поэтому второй клик до ре-рендера не отправит второй запрос.
  const isAcceptingRef = useRef(false);
  const isDeletingRef = useRef(false);

  const consentRequired = Boolean(
    user && shouldShowOnboarding(user.onboardingVersion),
  );

  useEffect(() => {
    if (!consentRequired || slidesTriggered) return;
    slidesTriggered = true;

    void (async () => {
      // Сбой загрузки чанка со слайдами не блокирует согласие:
      // слайды — украшение, юридически значим только акцепт.
      let slides;
      try {
        ({ ONBOARDING_SLIDES: slides } = await import("@/onboarding/slides"));
      } catch {
        return;
      }
      await showSlidesSheet(slides);
    })();
  }, [consentRequired]);

  // Без пользователя или с сохранённой версией — приложение как есть.
  if (!consentRequired) return <>{children}</>;

  const handleAccept = () => {
    if (isAcceptingRef.current) return;

    isAcceptingRef.current = true;
    setIsAccepting(true);
    setError(null);

    usersApi
      .completeOnboarding(ONBOARDING_VERSION)
      .then((updated) => {
        // Стор обновляем напрямую: user в useAuthStore — источник
        // и для этого гейта, и для всего приложения. После обновления
        // consentRequired становится false и гейт пропускает дальше.
        useAuthStore.setState({ user: updated });
      })
      .catch(() => {
        setError(
          "Не удалось сохранить согласие. Проверьте подключение к интернету и попробуйте ещё раз.",
        );
      })
      .finally(() => {
        isAcceptingRef.current = false;
        setIsAccepting(false);
      });
  };

  const handleDecline = () => setDeclined(true);
  const handleBackToConsent = () => setDeclined(false);

  /**
   * «Удалить мои данные» с экрана отказа: аккаунт уже создан при входе
   * (AuthGate до ConsentGate), поэтому отказ обязан предлагать реальное
   * удаление, а не «просто закрыть приложение». DELETE /users/me
   * обезличивает профиль; для нового пользователя активных обязательств
   * нет. После удаления стор переводится в терминальный «deleted».
   */
  const handleDeleteMyData = () => {
    if (isDeletingRef.current) return;

    isDeletingRef.current = true;
    setIsDeleting(true);
    setError(null);

    usersApi
      .deleteCurrentUser()
      .then(() => {
        useAuthStore.getState().markAccountDeleted();
      })
      .catch(() => {
        setError(
          "Не удалось удалить данные. Завершите активные поездки и брони и попробуйте ещё раз.",
        );
      })
      .finally(() => {
        isDeletingRef.current = false;
        setIsDeleting(false);
      });
  };

  return (
    <View activePanel={activePanel}>
      <Panel id={PANEL_CONSENT}>
        {declined ? (
          <Placeholder
            icon={<Icon56CheckCircleOutline />}
            title="Без согласия сервис недоступен"
            action={
              <ButtonGroup mode="vertical" stretched>
                <Button size="l" mode="primary" onClick={handleBackToConsent}>
                  Вернуться
                </Button>
                <Button
                  size="l"
                  mode="tertiary"
                  onClick={handleDeleteMyData}
                  loading={isDeleting}
                  disabled={isDeleting}
                >
                  Удалить мои данные
                </Button>
              </ButtonGroup>
            }
          >
            Для работы сервиса необходимо принять условия. Если вы не согласны —
            закройте приложение или удалите свои данные: профиль будет
            обезличен, восстановление невозможно.
          </Placeholder>
        ) : (
          <>
            {error && (
              <Box padding="system">
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {error}
                </Caption>
              </Box>
            )}
            <Placeholder
              icon={<Icon56CheckCircleOutline />}
              title="Добро пожаловать в «Едем»"
              action={
                <ButtonGroup mode="vertical" stretched>
                  <Button
                    size="l"
                    mode="primary"
                    onClick={handleAccept}
                    loading={isAccepting}
                    disabled={isAccepting}
                  >
                    Принять и продолжить
                  </Button>
                  <Button
                    size="l"
                    mode="tertiary"
                    onClick={handleDecline}
                    disabled={isAccepting}
                  >
                    Не принимать
                  </Button>
                </ButtonGroup>
              }
            >
              Сервис поиска попутчиков: платформа для совместных поездок, а не
              перевозчик. Расчёты — между пользователями. Сервис для лиц старше
              14 лет. Мы обрабатываем имя, фото и данные о поездках для работы
              сервиса и доставки уведомлений (в том числе через ВКонтакте).
            </Placeholder>

            <Group header={<Header size="s">Документы</Header>}>
              <SimpleCell
                chevron="always"
                onClick={() => setActivePanel(PANEL_TERMS)}
              >
                Пользовательское соглашение
              </SimpleCell>
              <SimpleCell
                chevron="always"
                onClick={() => setActivePanel(PANEL_PRIVACY)}
              >
                Политика конфиденциальности
              </SimpleCell>
            </Group>

            <Box padding="system">
              <Caption
                level="1"
                style={{ color: "var(--vkui--color_text_secondary)" }}
              >
                Нажимая «Принять и продолжить», вы соглашаетесь с условиями
                обоих документов.
              </Caption>
            </Box>

            {error && (
              <Box padding="system" paddingBlockStart={0}>
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {error}
                </Caption>
              </Box>
            )}
          </>
        )}
      </Panel>

      <Suspense fallback={<PanelSpinner />}>
        <TermsPanel
          id={PANEL_TERMS}
          onBack={() => setActivePanel(PANEL_CONSENT)}
        />
        <PrivacyPanel
          id={PANEL_PRIVACY}
          onBack={() => setActivePanel(PANEL_CONSENT)}
        />
      </Suspense>
    </View>
  );
};
