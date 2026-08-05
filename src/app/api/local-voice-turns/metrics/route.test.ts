import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordLocalInterpreterTurnMetric } from "@/lib/local-interpreter-metrics";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentStaff } from "@/lib/session";
import { POST } from "./route";

vi.mock("@/lib/local-interpreter-metrics", () => ({
  recordLocalInterpreterTurnMetric: vi.fn()
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: vi.fn(() => "127.0.0.1"),
  rateLimit: vi.fn(),
  rateLimitResponse: vi.fn((retryAfter: number) =>
    Response.json({ error: "Too many requests", retryAfter }, { status: 429 }))
}));
vi.mock("@/lib/session", () => ({
  getCurrentStaff: vi.fn()
}));

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/local-voice-turns/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const validMetric = {
  eventId: "123e4567-e89b-42d3-a456-426614174000",
  patientLanguage: "ja",
  direction: "patient_to_ko",
  transport: "realtime",
  outcome: "success",
  resultReadyMs: 1480,
  audioStartedMs: 1610,
  validationMs: 320,
  validationStatus: "repaired",
  corrected: true,
  verifiedSentence: false,
  appVersion: "0.3.37"
};

describe("local interpreter metrics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentStaff).mockResolvedValue({
      id: "staff-1",
      hospitalId: "hospital-1"
    } as unknown as Awaited<ReturnType<typeof getCurrentStaff>>);
    vi.mocked(rateLimit).mockResolvedValue({ ok: true, remaining: 119, retryAfter: 0 });
    vi.mocked(recordLocalInterpreterTurnMetric).mockResolvedValue({ id: validMetric.eventId });
  });

  it("records a text-free latency metric for the authenticated staff member", async () => {
    const response = await POST(request(validMetric));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(recordLocalInterpreterTurnMetric).toHaveBeenCalledWith(
      expect.objectContaining({ id: "staff-1", hospitalId: "hospital-1" }),
      expect.objectContaining(validMetric)
    );
  });

  it("rejects transcript fields and malformed events", async () => {
    const response = await POST(request({
      ...validMetric,
      sourceText: "目を開けてください。"
    }));

    expect(response.status).toBe(400);
    expect(recordLocalInterpreterTurnMetric).not.toHaveBeenCalled();
  });

  it("requires an authenticated staff session", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);

    const response = await POST(request(validMetric));

    expect(response.status).toBe(401);
    expect(recordLocalInterpreterTurnMetric).not.toHaveBeenCalled();
  });
});