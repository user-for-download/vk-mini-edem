// Edem full-cycle E2E (Playwright + Chromium)
// Водитель создаёт поездку → пассажир бронирует → водитель подтверждает →
// пассажир видит подтверждение + уведомление. Попутно проверяются сегодняшние
// UI-правки: свёрнутый аккордеон «Выбор даты», теги без рамки, статус без дублей.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3010";
const SHOTS = path.join(__dirname, "shots");
const DRIVER_ID = 100001; // seed: Skoda Octavia
const PASSENGER_ID = 100004; // seed: без авто
const PRICE = 777;

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let stepNo = 0;
const pageErrors = { driver: [], passenger: [] };

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function runStep(name, fn) {
  stepNo++;
  try {
    const detail = await fn();
    record(name, true, detail ?? "");
    return true;
  } catch (e) {
    record(name, false, String(e.message || e).split("\n").slice(0, 3).join(" ").slice(0, 300));
    return false;
  }
}

const tomorrow = new Date(Date.now() + 86400e3);
const ruDayLabel = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long", month: "long", day: "numeric",
}).format(tomorrow);

async function shot(page, name) {
  try { await page.screenshot({ path: `${SHOTS}/${String(stepNo).padStart(2, "0")}-${name}.png` }); } catch {}
}

async function openApp(browser, userId, role, who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((r) => { try { localStorage.setItem("edem-role", r); } catch {} }, role);
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => pageErrors[who].push(String(e).slice(0, 150)));
  const ts = Math.floor(Date.now() / 1000);
  page.authUrl = (hash = "/") =>
    `${BASE}/?vk_user_id=${userId}&vk_app_id=0&vk_platform=desktop_web&vk_ts=${ts}&sign=dev-sign#${hash}`;
  return { ctx, page };
}

// DateInput с enableTime: клик по дню и ввод времени меняют только ВНУТРЕННЕЕ
// значение — в onChange оно уходит лишь по кнопке «Готово» (onDoneButtonClick),
// а при закрытии календаря любым другим способом сбрасывается
// (resetValueOnCloseCalendar). Поэтому: день → время → «Готово».
async function fillDateInput(page, fieldLocator, timeStr) {
  await fieldLocator.click();
  await page.waitForTimeout(500);
  // VKUI Calendar открывается на текущем месяце (viewDate = today, value=null),
  // а showNeighboringMonth=false — дни соседних месяцев рендерятся пустыми div
  // без текста (CalendarDay.tsx: if (hidden) return <div/>). Если «завтра»
  // в другом месяце (напр., 31 авг → 1 сен), текста дня в DOM нет: кликаем
  // «Следующий месяц» (aria-label из CalendarHeader) и повторяем поиск.
  // Максимум 2 клика — защита от границы года (31 дек → 1 янв).
  const day = page.getByText(ruDayLabel, { exact: false }).first();
  for (let attempt = 0; attempt < 2; attempt++) {
    if ((await day.count()) > 0) break;
    const nextMonth = page.getByRole("button", { name: /Следующий месяц/ });
    if ((await nextMonth.count()) === 0) break; // кнопка скрыта — листать некуда
    await nextMonth.first().click();
    await page.waitForTimeout(400);
  }
  await day.waitFor({ state: "attached", timeout: 10000 });
  await day.click({ force: true });
  await page.waitForTimeout(400);
  const grid = page.locator('[role="grid"], [class*="vkuiCalendarDays"]').first();
  await grid.waitFor({ state: "visible", timeout: 5000 });
  const popup = grid.locator("xpath=ancestor-or-self::*[contains(@class, 'Popper')][1]");
  const timeInputs = popup.locator("input:not(.vkuiCustomSelectInput__el)");
  const n = await timeInputs.count();
  if (n >= 2) {
    await timeInputs.nth(0).click();
    await timeInputs.nth(0).pressSequentially(timeStr.slice(0, 2));
    await timeInputs.nth(1).click();
    await timeInputs.nth(1).pressSequentially(timeStr.slice(3));
  } else if (n === 1) {
    await timeInputs.first().click();
    await timeInputs.first().pressSequentially(timeStr);
  }
  await page.waitForTimeout(200);
  // Коммит значения + закрытие календаря
  await popup.getByRole("button", { name: "Готово" }).click();
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ headless: true });
let tripId = null;

try {
  // ================= ВОДИТЕЛЬ =================
  const driver = await openApp(browser, DRIVER_ID, "driver", "driver");
  const dp = driver.page;

  const authOk = await runStep("Водитель: авто-авторизация (dev-sign) и домашний экран", async () => {
    await dp.goto(dp.authUrl("/"));
    await dp.getByText("Едете куда-то за рулём?").waitFor({ timeout: 30000 });
    await shot(dp, "driver-home");
    return `vk_user_id=${DRIVER_ID}, роль=driver`;
  });
  if (!authOk) throw new Error("auth failed");

  await runStep("Поиск: аккордеон «Выбор даты» свёрнут по умолчанию", async () => {
    await dp.goto(dp.authUrl("/trips/search"));
    await dp.getByText("Поиск поездок").first().waitFor({ timeout: 15000 });
    await dp.getByText("Выбор даты").waitFor({ timeout: 10000 });
    const content = dp.getByText("Дата от").first();
    await dp.waitForTimeout(800); // дождаться анимации сворачивания
    const visible = await content.isVisible().catch(() => false);
    if (visible) throw new Error("Accordion.Content видим — аккордеон раскрыт");
    await shot(dp, "search-accordion-collapsed");
    return "саммари виден, контент скрыт";
  });

  const created = await runStep("Водитель: создание поездки Вологда → Череповец (завтра, 777₽, 3 места, тег)", async () => {
    await dp.goto(dp.authUrl("/trips/my"));
    await dp.getByText("Мои поездки").first().waitFor({ timeout: 15000 });
    await dp.locator('button[aria-label="Создать поездку"]').click();
    await dp.getByText("Новая поездка").waitFor({ timeout: 10000 });
    // Города — через CustomSelect (CityPickerField): кликаем поле (aria-label
    // «Откуда»/«Куда»), печатаем имя — фильтр сужает список, кликаем опцию.
    // Важно: города берутся из справочника (SEED_CITIES) — Москва/СПб в него не
    // входят (это админ-города), поэтому маршрут e2e — Вологда → Череповец.
    const selectCity = async (label, city) => {
      const field = dp.locator(`input[aria-label="${label}"]`);
      await field.click();
      await field.fill(city);
      const opt = dp.getByRole("option", { name: city, exact: true }).first();
      await opt.waitFor({ timeout: 10000 });
      await opt.click();
    };
    await selectCity("Откуда", "Вологда");
    await selectCity("Куда", "Череповец");
    // Адреса (свободный текст, не город)
    await dp.locator('input[placeholder="Например: м. Тёплый Стан"]').fill("м. Тёплый Стан");
    await dp.locator('input[placeholder="Например: м. Московская"]').fill("м. Московская");
    // Дата и время (DateInput — span[placeholder], не input)
    const dateField = dp.locator('[placeholder="Выберите дату и время"]');
    await fillDateInput(dp, dateField, "14:00");
    const dateValueAfter = await dateField.textContent().catch(() => "");
    console.log("  [date] after fillDateInput:", JSON.stringify(dateValueAfter?.slice(0, 40)));
    // Остальные поля
    await dp.locator('input[placeholder="Например: 4"]').fill("4");
    await dp.locator('input[placeholder="Например: 705"]').fill("700");
    await dp.locator('input[placeholder="700"]').fill(String(PRICE));
    // Места: по умолчанию уже 3 (MAX_SEATS) — кнопка «Больше мест» disabled
    // Тег через ChipsSelect (дропдаун откроется вверх — кнопка публикации
    // внизу остаётся доступной; клик по ней закроет дропдаун как outside-click)
    await dp.locator('input[placeholder="Можно с животными, багаж..."]').click();
    await dp.getByText("Можно с животными", { exact: true }).first().click();
    await dp.waitForTimeout(300);
    await shot(dp, "create-trip-form");
    // Публикация
    await dp.getByRole("button", { name: "Опубликовать поездку" }).click();
    await dp.waitForTimeout(1000);
    const alerts = await dp.locator('[role="alert"]').allTextContents().catch(() => []);
    if (alerts.length) console.log("  [alerts]:", JSON.stringify([...new Set(alerts)]));
    await dp.getByText("Поездка опубликована").waitFor({ timeout: 15000 });
    await shot(dp, "trip-published");
    return "цена 777₽, мест 3, тег «Можно с животными»";
  });
  if (!created) throw new Error("trip creation failed");

  await runStep("Водитель: поездка видна в «Мои поездки» (активные)", async () => {
    await dp.goto(dp.authUrl("/trips/my"));
    // VKUI 8.x: Card → vkuiCard__host (BEM)
    const card = dp.locator('[class*="vkuiCard__host"]', { hasText: "777 ₽" }).first();
    await card.waitFor({ timeout: 15000 });
    await shot(dp, "driver-my-trips");
    return "карточка с маршрутом и ценой 777₽ присутствует";
  });

  // ================= ПАССАЖИР =================
  const passenger = await openApp(browser, PASSENGER_ID, "passenger", "passenger");
  const pp = passenger.page;

  const pAuth = await runStep("Пассажир: авто-авторизация и экран поиска", async () => {
    await pp.goto(pp.authUrl("/trips/search"));
    await pp.getByText("Поиск поездок").first().waitFor({ timeout: 30000 });
    await shot(pp, "passenger-search");
    return `vk_user_id=${PASSENGER_ID}, роль=passenger`;
  });
  if (!pAuth) throw new Error("passenger auth failed");

  const found = await runStep("Пассажир: поиск «Вологда - Череповец» нашёл поездку водителя", async () => {
    await pp.locator('input[placeholder="Откуда — куда"]').fill("Вологда - Череповец");
    // VKUI 8.x: Card → vkuiCard__host (BEM)
    const card = pp.locator('[class*="vkuiCard__host"]', { hasText: "777 ₽" }).first();
    await card.waitFor({ timeout: 15000 });
    await shot(pp, "search-results");
    return "карточка 777₽ в выдаче";
  });
  if (!found) throw new Error("trip not found in search");

  const detailsOk = await runStep("Детали: теги без рамки Card + статус без дублирования", async () => {
    await pp.locator('[class*="vkuiCard__host"]', { hasText: "777 ₽" }).first().click();
    await pp.getByText("Особенности поездки").waitFor({ timeout: 10000 });
    // Тег виден как ContentBadge
    await pp.getByText("Можно с животными").first().waitFor({ timeout: 5000 });
    // Внутри секции тегов нет Card (рамка убрана)
    const tagsGroup = pp.locator(".vkuiGroup", { hasText: "Особенности поездки" }).first();
    const cardsInTags = await tagsGroup.locator('[class*="vkuiCard"]').count();
    if (cardsInTags > 0) throw new Error(`в секции тегов найдено Card: ${cardsInTags}`);
    // Дублей статуса нет (бронь ещё не создана — проверяем отсутствие текста со скобками)
    const dupText = await pp.getByText("(Ожидает подтверждения)").count();
    if (dupText > 0) throw new Error("найден дублирующий текст «(Ожидает подтверждения)»");
    await shot(pp, "trip-details");
    tripId = (await pp.evaluate(() => location.hash)).match(/\/trips\/([^/?]+)/)?.[1] ?? null;
    return `Card в секции тегов: 0; дублей: 0; tripId=${tripId}`;
  });
  if (!detailsOk) throw new Error("details check failed");

  const booked = await runStep("Пассажир: бронирование места (Забронировать · 777 ₽)", async () => {
    await pp.getByText("Место 1").first().waitFor({ timeout: 5000 }).catch(() => {});
    await pp.getByRole("button", { name: /Забронировать/ }).click();
    await pp.getByText("Забронировано").waitFor({ timeout: 15000 });
    await pp.getByText("Ожидайте подтверждения от водителя").waitFor({ timeout: 5000 }).catch(() => {});
    await shot(pp, "booking-done");
    return "снэкбар «Забронировано», возврат к поиску";
  });
  if (!booked) throw new Error("booking failed");

  await runStep("Пассажир: статус «Заявка на место No1 отправлена» без дублей", async () => {
    await pp.locator('[class*="vkuiCard__host"]', { hasText: "777 ₽" }).first().click();
    await pp.getByText("Заявка на место No1 отправлена").waitFor({ timeout: 10000 });
    await pp.getByText("Ожидайте подтверждения от водителя.").waitFor({ timeout: 5000 });
    const dup = await pp.getByText("(Ожидает подтверждения)").count();
    if (dup > 0) throw new Error("дублирование текста статуса");
    await shot(pp, "booking-pending");
    // Переходим на профиль — WS подключён, будем ловить snackbar
    // после подтверждения водителя (шаг следующий)
    await pp.goto(pp.authUrl("/profile"));
    await pp.getByText("Профиль").first().waitFor({ timeout: 10000 });
    return "заголовок без скобок, текст статуса один";
  });

  // ================= ВОДИТЕЛЬ: подтверждение =================
  const confirmed = await runStep("Водитель: заявка видна в «Управление заявками (1)» → подтвердить", async () => {
    await dp.goto(dp.authUrl(`/trips/${tripId}`));
    await dp.getByText(/Управление заявками \(1\)/).waitFor({ timeout: 15000 });
    await shot(dp, "driver-requests");
    // RichCell-реворк (5b9db19): кнопка подтверждения заявки — «Принять заявку»
    // (ранее «Подтвердить»). Клик = мгновенное решение, без диалога.
    await dp.getByRole("button", { name: "Принять заявку" }).click();
    await dp.getByText(/Подтвержденные пассажиры \(1\)/).waitFor({ timeout: 15000 });
    await shot(dp, "driver-confirmed");
    return "заявка подтверждена, секция сменилась на «Подтвержденные пассажиры (1)»";
  });
  if (!confirmed) throw new Error("confirm failed");

  // ================= ПАССАЖИР: подтверждение + уведомление =================
  // Пассажир уже на странице профиля (WS подключён) — ловим snackbar
  await runStep("Пассажир: snackbar «Ваша заявка подтверждена!»", async () => {
    await pp.getByText("Ваша заявка подтверждена!").waitFor({ timeout: 20000 });
    await shot(pp, "booking-confirmed-snackbar");
    return "snackbar о подтверждении получен";
  });

  // Проверяем статус брони на странице поездки
  await runStep("Пассажир: статус «Место No1 забронировано» после подтверждения", async () => {
    await pp.goto(pp.authUrl(`/trips/${tripId}`));
    await pp.getByText("Место No1 забронировано").waitFor({ timeout: 15000 });
    await pp.getByText("Водитель подтвердил вашу бронь. Приятной поездки!").waitFor({ timeout: 5000 });
    await shot(pp, "booking-confirmed");
    return "статус подтверждён";
  });

  // ================= ВОДИТЕЛЬ: завершение поездки =================
  // canCompleteTrip требует departureTime <= now — сдвигаем время отправления
  // в прошлое через БД, чтобы кнопка «Завершить поездку» стала доступна.
  const completed = await runStep("Водитель: завершить поездку (departureTime в прошлом)", async () => {
    // Сдвигаем departureAt на 24 часа назад —.trip создаётся с временем
    // в часовом поясе Москвы (UTC+3), а NOW() — UTC. Нужен большой запас,
    // чтобы departureAt гарантированно был в прошлом.
    const { execSync } = await import("node:child_process");
    execSync(
      `docker exec vk-mini-edem-db-dev psql -U edem -d edem -c "UPDATE \\"Trip\\" SET \\"departureAt\\" = NOW() - INTERVAL '24 hours' WHERE id = '${tripId}';"`,
      { stdio: "pipe" }
    );
    // Переходим на страницу поездки — кнопка «Завершить поездку» должна быть активна.
    // Используем reload чтобы сбросить React Query кэш и получить свежие данные.
    await dp.goto(dp.authUrl(`/trips/${tripId}`), { waitUntil: "networkidle" });
    await dp.waitForTimeout(1000);
    await dp.reload({ waitUntil: "networkidle" });
    await dp.waitForTimeout(3000);
    // VKUI Button —普通 click (timezone fix ensures canCompleteTrip=true)
    await dp.locator('button:has-text("Завершить поездку")').click({ timeout: 15000 });
    // Подтверждение в диалоге (VKUI Alert)
    await dp.locator('.vkuiAlert__button:has-text("Завершить")').click({ timeout: 10000 });
    await dp.getByText("Поездка завершена").waitFor({ timeout: 15000 });
    await shot(dp, "trip-completed");
    return "поездка завершена, статус archived";
  });
  if (!completed) throw new Error("trip completion failed");

  // ================= ПАССАЖИР: отзыв =================
  // После завершения поездки пассажир может оставить отзыв через
  // «поездки для отзыва» на странице профиля.
  const reviewOk = await runStep("Пассажир: оставить отзыв (5★ + комментарий)", async () => {
    // Переходим на профиль — там появится «поездки для отзыва».
    // reload обязателен: goto по тому же origin не сбрасывает кэш React Query,
    // а available-trips закеширован до завершения поездки (пассажир был
    // на /profile в шагах 11–12). Тот же паттерн, что у водителя в шаге 13.
    await pp.goto(pp.authUrl("/profile"));
    await pp.reload({ waitUntil: "networkidle" });
    await pp.waitForTimeout(1000);
    await pp.getByText("Профиль").first().waitFor({ timeout: 10000 });
    // Ждём появления поездки в секции «поездки для отзыва»
    await pp.getByText("Вологда → Череповец").first().waitFor({ timeout: 15000 });
    // Кликаем на поездку (SimpleCell) чтобы открыть модалку отзыва
    await pp.getByText("Вологда → Череповец").first().click();
    // Модальное окно CreateReviewModal
    await pp.getByText("Отзыв о").first().waitFor({ timeout: 10000 });
    // Рейтинг по умолчанию 5 — оставляем как есть
    // Вводим комментарий
    await pp.locator("textarea").fill("Отличная поездка, приятный водитель!");
    await pp.waitForTimeout(300);
    await shot(pp, "review-form");
    // Отправляем отзыв
    await pp.getByRole("button", { name: "Отправить отзыв" }).click();
    await pp.getByText("Отзыв отправлен").waitFor({ timeout: 15000 });
    await shot(pp, "review-submitted");
    return "отзыв отправлен, snackbar «Отзыв отправлен»";
  });
  if (!reviewOk) throw new Error("review failed");

  // ================= PUSH-УВЕДОМЛЕНИЯ VK =================
  // Покрытие коммита a7a9080: на /profile/notifications должна быть панель
  // с блоком «Push-уведомления VK» (Banner с «Включить» вне VK, или
  // SimpleCell «Включены — ...» если push уже выдан в прошлом прогоне).
  // Селекторы устойчивые (текст + ARIA), без привязки к BEM-классам VKUI.
  const pushPanelOk = await runStep("Mini-app: /profile/notifications → блок «Push-уведомления VK» (Banner «Включить» или SimpleCell «Включены»)", async () => {
    // Открываем /profile (если ещё не там) и кликаем «Уведомления»
    await pp.goto(pp.authUrl("/profile"));
    await pp.getByText("Профиль").first().waitFor({ timeout: 10000 });
    // Вне VK браузерный dev-режим может рендерить панель сразу, без ремоунта —
    // кликаем только если ячейка «Уведомления» видна
    const cell = pp.getByText("Уведомления", { exact: true }).first();
    if (await cell.isVisible().catch(() => false)) {
      await cell.click();
    } else {
      // fallback: прямой переход по хэшу
      await pp.evaluate(() => { window.location.hash = "#/profile/notifications"; });
    }
    // Хедер панели
    await pp.getByRole("heading", { name: "Уведомления" }).waitFor({ timeout: 10000 })
      .catch(async () => {
        // В VKUI хедер может быть не <h*>, а кнопкой/div с текстом — fallback
        await pp.locator("text=Уведомления").first().waitFor({ timeout: 5000 });
      });
    // Блок «Push-уведомления VK» (Banner title ИЛИ SimpleCell children)
    const pushBlock = pp.getByText("Push-уведомления VK", { exact: true }).first();
    await pushBlock.waitFor({ timeout: 10000 });
    // Состояние 1: push НЕ включён → Banner с кнопкой «Включить»
    // Состояние 2: push включён → SimpleCell с подзаголовком «Включены — ...»
    // В dev-моке моста vk_are_notifications_enabled=1, поэтому ожидаем
    // SimpleCell; регексп без \b — \b в JS не работает с кириллицей.
    const enableBtn = pp.getByRole("button", { name: "Включить" });
    const enabledCell = pp.getByText(/Включены/);
    const btnVisible = await enableBtn.isVisible().catch(() => false);
    const cellVisible = await enabledCell.isVisible().catch(() => false);
    if (!btnVisible && !cellVisible) {
      throw new Error("нет ни кнопки «Включить», ни строки «Включены» — панель не отрисована");
    }
    // Switch «Отключить некритичные уведомления» — общий для обоих состояний
    await pp.getByText("Отключить некритичные уведомления").first().waitFor({ timeout: 5000 });
    await shot(pp, "push-panel");
    return btnVisible ? "Banner «Включить»" : "SimpleCell «Включены»";
  });
  if (!pushPanelOk) console.log("⚠ push-панель не открылась — шаг FAIL, но дальше не идём");
} catch (e) {
  console.log(`⛔ Скрипт остановлен: ${String(e.message || e).split("\n")[0]}`);
} finally {
  await browser.close();
}

// ================= ИТОГ =================
console.log("\n========== ИТОГ ==========");
const passed = results.filter((r) => r.ok).length;
console.log(`Пройдено: ${passed}/${results.length}`);
for (const [who, errs] of Object.entries(pageErrors)) {
  if (errs.length) console.log(`⚠ pageerror (${who}): ${errs.slice(0, 3).join(" | ")}`);
}
fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify({ results, pageErrors }, null, 1));
process.exit(passed === results.length && results.length > 0 ? 0 : 1);
