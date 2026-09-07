// mini-app/src/modals/ReportModal/__tests__/ReportModal.test.tsx
//
// Рендер-тесты лимита «1 жалоба навсегда» без @testing-library/react:
// react-dom/server renderToString (среда node), модалка внутри ModalRoot
// с activeModal — паттерн как в CreateReviewModal.test.tsx.
//
// Хуки мокаются (vi.hoisted + vi.mock): SnackbarProvider,
// useReportsQuery (mutation + список моих жалоб), чтобы не тянуть
// react-query в рендер-тест.
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ModalRoot } from "@vkontakte/vkui";
import type { Report } from "@edem/contracts";

const { mockEnqueue, mockMutate, mockState } = vi.hoisted(() => ({
  mockEnqueue: vi.fn(),
  mockMutate: vi.fn(),
  mockState: { myReports: [] as Report[] },
}));

vi.mock("@/providers/SnackbarProvider", () => ({
  useSnackbar: () => ({ enqueue: mockEnqueue }),
}));

vi.mock("@/queries/useReportsQuery", () => ({
  useCreateReportMutation: () => ({ mutate: mockMutate, isPending: false }),
  useMyReportsQuery: () => ({ data: mockState.myReports }),
}));

import { ReportModal } from "@/modals/ReportModal/ReportModal";

const MODAL_ID = "report-modal";

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    targetType: "trip",
    targetId: "trip-1",
    category: "safety",
    description: "Проблема в поездке",
    status: "pending",
    resolutionNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    ...overrides,
  };
}

function renderOpenModal(): string {
  return renderToString(
    <ModalRoot activeModal={MODAL_ID} disableModalOverlay>
      <ReportModal
        modalProps={{ id: MODAL_ID }}
        close={vi.fn()}
        update={vi.fn()}
        targetType="trip"
        targetId="trip-1"
      />
    </ModalRoot>,
  );
}

describe("ReportModal — лимит «1 жалоба навсегда»", () => {
  it("без prior-жалобы: кнопка активна, хинта нет", () => {
    mockState.myReports = [];
    const html = renderOpenModal();

    expect(html).toContain("Отправить жалобу");
    expect(html).not.toContain("vkuiButton__disabled");
    expect(html).not.toContain("Повторная отправка недоступна");
  });

  it("жалоба на этот объект уже есть: кнопка «Жалоба уже отправлена» disabled + хинт", () => {
    mockState.myReports = [makeReport()];
    const html = renderOpenModal();

    expect(html).toContain("Жалоба уже отправлена");
    expect(html).not.toContain("Отправить жалобу");
    expect(html).toContain("vkuiButton__disabled");
    expect(html).toContain("Повторная отправка недоступна");
  });

  it("жалоба на другой объект: кнопка активна", () => {
    mockState.myReports = [makeReport({ targetId: "trip-2" })];
    const html = renderOpenModal();

    expect(html).not.toContain("vkuiButton__disabled");
  });

  it("рассмотренная жалоба тоже блокирует повтор (семантика forever)", () => {
    mockState.myReports = [makeReport({ status: "resolved", resolvedAt: new Date().toISOString() })];
    const html = renderOpenModal();

    expect(html).toContain("vkuiButton__disabled");
  });
});
