import { Button, Placeholder, Spinner } from "@telegram-apps/telegram-ui";

export function QueryState({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  emptyText: string;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (loading) return <Placeholder><span role="status" aria-label="Загрузка"><Spinner size="m" /></span></Placeholder>;
  if (error) {
    return (
      <Placeholder header="Не удалось загрузить данные" description="Проверьте соединение и повторите попытку.">
        <Button onClick={onRetry}>Повторить</Button>
      </Placeholder>
    );
  }
  if (empty) return <Placeholder header="Пока пусто" description={emptyText} />;
  return <>{children}</>;
}
