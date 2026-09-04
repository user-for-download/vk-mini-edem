import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bridge,
  requestNotificationsPermission,
  showSlidesSheet,
  triggerHaptic,
} from "./bridge";

afterEach(() => vi.restoreAllMocks());

function mockSupport(value: boolean) {
  Object.defineProperty(bridge, "supportsAsync", {
    configurable: true,
    value: vi.fn().mockResolvedValue(value),
  });
}

describe("triggerHaptic", () => {
  it("sends supported haptic feedback", async () => {
    mockSupport(true);
    const send = vi.spyOn(bridge, "send").mockResolvedValue({ result: true });

    await expect(triggerHaptic("medium")).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith("VKWebAppTapticImpactOccurred", { style: "medium" });
  });

  it("does nothing when haptics are unsupported", async () => {
    mockSupport(false);
    const send = vi.spyOn(bridge, "send");

    await expect(triggerHaptic()).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails safely when the bridge rejects the call", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockRejectedValue(new Error("bridge unavailable"));

    await expect(triggerHaptic("heavy")).resolves.toBe(false);
  });
});

describe("showSlidesSheet", () => {
  const slides = [
    {
      media: { type: "image" as const, blob: "data:image/png;base64,test" },
      title: "Заголовок",
      subtitle: "Описание",
    },
  ];

  it("метод не поддерживается -> unsupported без вызова send", async () => {
    mockSupport(false);
    const send = vi.spyOn(bridge, "send");

    await expect(showSlidesSheet(slides)).resolves.toEqual({ status: "unsupported" });
    expect(send).not.toHaveBeenCalled();
  });

  it("пользователь просмотрел все слайды -> confirm", async () => {
    mockSupport(true);
    const send = vi
      .spyOn(bridge, "send")
      .mockResolvedValue({ result: true, action: "confirm" });

    await expect(showSlidesSheet(slides)).resolves.toEqual({ status: "confirm" });
    expect(send).toHaveBeenCalledWith("VKWebAppShowSlidesSheet", { slides });
  });

  it("отмена на слайде -> reject с индексом слайда", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockResolvedValue({
      result: true,
      action: "reject",
      slide_index: 2,
    });

    await expect(showSlidesSheet(slides)).resolves.toEqual({
      status: "reject",
      slideIndex: 2,
    });
  });

  it("reject без slide_index -> индекс 0", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockResolvedValue({ result: true, action: "reject" });

    await expect(showSlidesSheet(slides)).resolves.toEqual({
      status: "reject",
      slideIndex: 0,
    });
  });

  it("закрытие другим способом -> cancel", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockResolvedValue({ result: true, action: "cancel" });

    await expect(showSlidesSheet(slides)).resolves.toEqual({ status: "cancel" });
  });

  it("платформа вернула result !== true -> failed", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockResolvedValue({ result: false });

    await expect(showSlidesSheet(slides)).resolves.toEqual({ status: "failed" });
  });

  it("ошибка bridge -> failed (без исключения)", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockRejectedValue(new Error("bridge unavailable"));

    await expect(showSlidesSheet(slides)).resolves.toEqual({ status: "failed" });
  });
});

describe("requestNotificationsPermission", () => {
  it("метод не поддерживается -> unsupported без вызова send", async () => {
    mockSupport(false);
    const send = vi.spyOn(bridge, "send");

    await expect(requestNotificationsPermission()).resolves.toBe("unsupported");
    expect(send).not.toHaveBeenCalled();
  });

  it("пользователь разрешил уведомления -> success", async () => {
    mockSupport(true);
    const send = vi
      .spyOn(bridge, "send")
      .mockResolvedValue({ result: true });

    await expect(requestNotificationsPermission()).resolves.toBe("success");
    expect(send).toHaveBeenCalledWith("VKWebAppAllowNotifications", {});
  });

  it("пользователь отклонил -> cancelled", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockResolvedValue({ result: false });

    await expect(requestNotificationsPermission()).resolves.toBe("cancelled");
  });

  it("платформа вернула пустой ответ -> cancelled", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof bridge.send>>
    );

    await expect(requestNotificationsPermission()).resolves.toBe("cancelled");
  });

  it("ошибка bridge -> failed (без исключения)", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockRejectedValue(new Error("bridge unavailable"));

    await expect(requestNotificationsPermission()).resolves.toBe("failed");
  });
});
