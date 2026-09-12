import { describe, expect, it, vi } from "vitest";
import {
  handleModalBack,
  pushModalBackHandler,
} from "@/utils/modalBack";

describe("modalBack stack (BackButton state-модалок)", () => {
  it("пустой стек — false, навигация нужна", () => {
    expect(handleModalBack()).toBe(false);
  });

  it("верхний хендлер перехватывает первым (LIFO)", () => {
    const order: string[] = [];
    const releaseFirst = pushModalBackHandler(() => order.push("first"));
    const releaseSecond = pushModalBackHandler(() => order.push("second"));
    expect(handleModalBack()).toBe(true);
    expect(order).toEqual(["second"]);
    releaseSecond();
    expect(handleModalBack()).toBe(true);
    expect(order).toEqual(["second", "first"]);
    releaseFirst();
    expect(handleModalBack()).toBe(false);
  });

  it("release убирает хендлер из стека", () => {
    const handler = vi.fn();
    const release = pushModalBackHandler(handler);
    release();
    release();
    expect(handleModalBack()).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
