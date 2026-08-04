// mini-app/src/components/EmptyState.tsx
import { type FC, type ReactNode } from "react";
import { Placeholder } from "@vkontakte/vkui";

export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export const EmptyState: FC<EmptyStateProps> = ({ title, subtitle, action }) => {
  return (
    <Placeholder
      title={title}
      action={action}
    >
      {subtitle}
    </Placeholder>
  );
};
