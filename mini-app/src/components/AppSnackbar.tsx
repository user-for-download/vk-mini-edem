// mini-app/src/components/AppSnackbar.tsx
import { type FC } from "react";
import { Snackbar } from "@vkontakte/vkui";
import { Icon28CheckCircleOutline, Icon28ErrorOutline, Icon28InfoCircleOutline } from "@vkontakte/icons";
import { useSnackbarStore } from "@/store/useSnackbarStore";

export const AppSnackbar: FC = () => {
  const current = useSnackbarStore((state) => state.current);
  const dismiss = useSnackbarStore((state) => state.dismiss);

  if (!current) {
    return null;
  }

  const icon =
    current.type === "success" ? (
      <Icon28CheckCircleOutline fill="var(--vkui--color_icon_positive)" />
    ) : current.type === "error" ? (
      <Icon28ErrorOutline fill="var(--vkui--color_icon_negative)" />
    ) : (
      <Icon28InfoCircleOutline fill="var(--vkui--color_icon_accent)" />
    );

  return (
    <Snackbar
      onClosed={dismiss}
      before={icon}
      subtitle={current.subtitle}
    >
      {current.title}
    </Snackbar>
  );
};
