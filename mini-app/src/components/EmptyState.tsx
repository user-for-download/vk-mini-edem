// mini-app/src/components/EmptyState.tsx
import { type FC, type ReactNode } from "react";
import { Placeholder } from "@vkontakte/vkui";
import { Icon56GhostOutline } from "@vkontakte/icons";

export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/**
 * Пустое состояние по канону Placeholder: иконка 56 outline,
 * описание plain-строкой, кнопки size="l" — в action вызывающей стороны.
 */
export const EmptyState: FC<EmptyStateProps> = ({
  title,
  subtitle,
  action,
  icon,
}) => {
  return (
    <Placeholder
      icon={icon ?? <Icon56GhostOutline />}
      title={title}
      action={action}
    >
      {subtitle}
    </Placeholder>
  );
};
