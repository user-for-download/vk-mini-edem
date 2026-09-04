import { describe, expect, it, vi } from "vitest";
import {
  SAFE_BACK_FALLBACK_ROUTE,
  performBackNavigation,
  resolveBackNavigation,
} from "./useSwipeBackSync";

describe("resolveBackNavigation", () => {
  it("первая запись истории ведёт на безопасный fallback", () => {
    expect(SAFE_BACK_FALLBACK_ROUTE).toBe("/");
    expect(resolveBackNavigation(true)).toEqual({ kind: "replace", route: "/" });
  });

  it("обычная навигация внутри приложения не меняется", () => {
    expect(resolveBackNavigation(false)).toEqual({ kind: "back" });
  });

  it("уважает кастомный fallback", () => {
    expect(resolveBackNavigation(true, "/trips/search")).toEqual({
      kind: "replace",
      route: "/trips/search",
    });
  });
});

describe("performBackNavigation", () => {
  function createNavigator() {
    const calls: string[] = [];
    return {
      calls,
      routeNavigator: {
        back: () => {
          calls.push("back");
        },
        replace: (route: string) => {
          calls.push(`replace:${route}`);
        },
      },
    };
  }

  it("вход по deep-link + back ведёт на fallback, а не закрывает мини-апп", () => {
    // Arrange: первая запись истории (точка входа — deep-link)
    const { calls, routeNavigator } = createNavigator();

    // Act
    performBackNavigation(routeNavigator, true);

    // Assert
    expect(calls).toEqual(["replace:/"]);
    expect(routeNavigator.back).toBeDefined();
  });

  it("back внутри обычной истории вызывает back() без replace", () => {
    // Arrange
    const { calls, routeNavigator } = createNavigator();

    // Act
    performBackNavigation(routeNavigator, false);

    // Assert
    expect(calls).toEqual(["back"]);
  });

  it("пробрасывает ошибки навигатора наружу, а не глотает молча", () => {
    const routeNavigator = {
      back: () => {
        throw new Error("nav failed");
      },
      replace: vi.fn(),
    };

    expect(() => performBackNavigation(routeNavigator, false)).toThrow("nav failed");
  });
});
