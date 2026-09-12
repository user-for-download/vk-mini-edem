import { Button, Title } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";

export function PageHeader({ title, action }: { title: string; action?: { label: string; to: string } }) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between gap-4 px-4 pt-5 pb-3">
      <Title level="1" weight="2">{title}</Title>
      {action && <Button size="s" mode="bezeled" onClick={() => navigate(action.to)}>{action.label}</Button>}
    </header>
  );
}
