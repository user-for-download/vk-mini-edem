// mini-app/src/helpers/__tests__/vkLink.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const openExternalUrlMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/helpers/bridge", () => ({
  openExternalUrl: (...args: unknown[]) => openExternalUrlMock(...args),
}));

import { buildVkMessageUrl, openVkMessages } from "@/helpers/vkLink";

describe("buildVkMessageUrl", () => {
  it("строит каноническую ссылку на диалог vk.com/im?sel=<id>", () => {
    expect(buildVkMessageUrl(174028905)).toBe("https://vk.com/im?sel=174028905");
  });

  it("работает с любым положительным VK ID", () => {
    expect(buildVkMessageUrl(1)).toBe("https://vk.com/im?sel=1");
    expect(buildVkMessageUrl(2147483647)).toBe("https://vk.com/im?sel=2147483647");
  });
});

describe("openVkMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("открывает построенную ссылку через openExternalUrl", async () => {
    // Act
    await openVkMessages(174028905);

    // Assert
    expect(openExternalUrlMock).toHaveBeenCalledTimes(1);
    expect(openExternalUrlMock).toHaveBeenCalledWith(
      "https://vk.com/im?sel=174028905",
    );
  });
});
