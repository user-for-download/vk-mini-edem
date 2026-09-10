import { Button, Title } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";

export function PageHeader({ title, action }: { title: string; action?: { label: string; to: string } }) {
  const navigate = useNavigate();
  return (
    <header className="PageHeader">
      <Title level="1" weight="2">{title}</Title>
      {action && <Button size="s" onClick={() => navigate(action.to)}>{action.label}</Button>}
    </header>
  );
}
