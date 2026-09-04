import { afterEach, describe, expect, it } from "vitest";
import { positiveIntEnv } from "../../src/env.js";

const NAME = "P4_TEST_POSITIVE_INT";

afterEach(() => {
  delete process.env[NAME];
});

describe("positiveIntEnv", () => {
  it("uses the fallback only when the variable is absent", () => {
    expect(positiveIntEnv(NAME, 42)).toBe(42);
  });

  it.each(["0", "-1", "1.5", "12ms", "Infinity"])(
    "rejects invalid value %s",
    (value) => {
      process.env[NAME] = value;

      expect(() => positiveIntEnv(NAME, 42)).toThrow(
        `[env] ${NAME} must be a positive integer.`
      );
    }
  );

  it("accepts a positive safe integer", () => {
    process.env[NAME] = "1200";

    expect(positiveIntEnv(NAME, 42)).toBe(1200);
  });
});
