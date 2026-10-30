import { expect, it } from "vitest";
import { formatElapsed } from "./RunStatus";

it("reads elapsed time in seconds, then minutes", () => {
  expect(formatElapsed(0)).toBe("0s");
  expect(formatElapsed(999)).toBe("0s");
  expect(formatElapsed(12_400)).toBe("12s");
  expect(formatElapsed(59_999)).toBe("59s");
  expect(formatElapsed(65_000)).toBe("1m 05s");
  expect(formatElapsed(-5)).toBe("0s");
});
