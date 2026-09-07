// mini-app/src/helpers/__tests__/confirmQueue.test.ts
//
// Unit-тесты сериализации confirm-диалогов: второй вызов во время
// открытого первого встаёт в очередь (раньше детерминированно
// возвращал false — удаление профиля молча не работало).
import { describe, expect, it, vi } from "vitest";
import { chainConfirmTask } from "@/helpers/confirmQueue";

describe("chainConfirmTask", () => {
  it("открывает задачи строго по очереди", async () => {
    const order: string[] = [];
    let tail: Promise<void> = Promise.resolve();

    const first = chainConfirmTask(tail, async () => {
      order.push("first-open");
      return true;
    });
    tail = first.tail;
    const second = chainConfirmTask(tail, async () => {
      order.push("second-open");
      return false;
    });

    await expect(first.task).resolves.toBe(true);
    await expect(second.task).resolves.toBe(false);
    expect(order).toEqual(["first-open", "second-open"]);
  });

  it("второй не открывается раньше завершения первого", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const openSecond = vi.fn(async () => "second");

    const first = chainConfirmTask(Promise.resolve(), () => gate.then(() => "first"));
    const second = chainConfirmTask(first.tail, openSecond);

    await Promise.resolve();
    await Promise.resolve();
    expect(openSecond).not.toHaveBeenCalled();

    release();
    await expect(second.task).resolves.toBe("second");
    expect(openSecond).toHaveBeenCalledTimes(1);
  });

  it("цепочка живёт после отказа задачи", async () => {
    const first = chainConfirmTask(Promise.resolve(), async () => {
      throw new Error("closed without choice");
    });
    const second = chainConfirmTask(first.tail, async () => "next");

    await expect(first.task).rejects.toThrow();
    await expect(second.task).resolves.toBe("next");
  });
});
