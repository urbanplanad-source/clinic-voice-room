import { describe, expect, it, vi } from "vitest";
import { runWithBoundedRetry } from "./bounded-retry";

describe("runWithBoundedRetry", () => {
  it("returns immediately when the first attempt succeeds", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    const onFailure = vi.fn();

    await expect(
      runWithBoundedRetry({ maxAttempts: 2, operation, onFailure })
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("retries once and returns the recovered result", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce("recovered");
    const onFailure = vi.fn();

    await expect(
      runWithBoundedRetry({ maxAttempts: 2, operation, onFailure })
    ).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        maxAttempts: 2,
        errorName: "TimeoutError"
      })
    );
  });

  it("throws the final error after the attempt limit", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("translation_failed"));
    const onFailure = vi.fn();

    await expect(
      runWithBoundedRetry({ maxAttempts: 2, operation, onFailure })
    ).rejects.toThrow("translation_failed");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledTimes(2);
  });
});