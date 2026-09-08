-- Момент акцепта правовых документов (ConsentGate): доказательство
-- согласия по 152-ФЗ ст. 9. Проставляется POST /users/me/onboarding,
-- сбрасывается при удалении аккаунта и админ-сбросе онбординга.
ALTER TABLE "User" ADD COLUMN "consentAcceptedAt" TIMESTAMP(3);
