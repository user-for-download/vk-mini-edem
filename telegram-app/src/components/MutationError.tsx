export function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Не удалось выполнить действие";
  return <p className="FormError" role="alert">{message}</p>;
}
