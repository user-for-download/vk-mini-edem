// Вне Telegram (прод-сборка): init data и launch params отсутствуют,
// SDK бросает при retrieveLaunchParams — показываем объяснение.
export function EnvUnsupported() {
  return (
    <div className="RootError">
      <div className="RootError__content">
        <p>«Едем» — мини-приложение Telegram.</p>
        <p>Откройте его через кнопку бота @edem_mini_bot в Telegram.</p>
      </div>
    </div>
  );
}
