import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { patientLanguages } from "../lib/languages";

describe("MediVoice accessibility and visual safety contracts", () => {
  it("supports every patient language without storing patient content", () => {
    const control = readFileSync(new URL("./PatientTextSizeControl.tsx", import.meta.url), "utf8");
    for (const language of patientLanguages) {
      expect(control).toContain(`${language}: {`);
    }
    expect(control).toContain("medivoice:patient-text-size");
    expect(control).toContain('aria-pressed={selected}');
    expect(control).toContain("min-h-11 min-w-11");
    expect(control).toContain('"patient-text-default"');
    expect(control).toContain('"patient-text-large"');
    expect(control).toContain('"patient-text-largest"');
    expect(control).not.toContain("sourceText");
    expect(control).not.toContain("translation");
  });

  it("keeps text sizing scoped to patient surfaces", () => {
    const join = readFileSync(new URL("./PatientJoin.tsx", import.meta.url), "utf8");
    const consultation = readFileSync(new URL("./ConsultationChatRoom.tsx", import.meta.url), "utf8");
    const procedure = readFileSync(new URL("./VoiceRoom.tsx", import.meta.url), "utf8");
    expect(join).toContain("patient-text-surface");
    expect(consultation).toContain('role === "patient" ? `patient-text-surface');
    expect(procedure).toContain('role === "patient" ? `patient-text-surface');
    expect(procedure).toContain("patientFixedMic");
    expect(procedure).toContain("env(safe-area-inset-bottom)");
    expect(procedure).toContain("fixed inset-x-4");
    expect(procedure).toContain("whitespace-pre-wrap break-words");
  });

  it("keeps patient message spacing readable at every text size", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".patient-text-surface .patient-message-copy");
    expect(css).toContain("line-height: 1.55");
  });

  it("provides visible focus and reduced-motion fallbacks", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain("body :focus-visible");
    expect(css).toContain("outline: 3px solid #1d4ed8 !important");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses one PWA brand color and real PNG icon sizes", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8")) as { theme_color: string; background_color: string; icons: Array<{ sizes: string }> };
    expect(layout).toContain('themeColor: "#3182f6"');
    expect(layout).not.toContain("next/font");
    expect(manifest.theme_color).toBe("#3182f6");
    expect(manifest.background_color).toBe("#f7f8fa");
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
  });

  it("keeps internal admin links permission-gated", () => {
    const nav = readFileSync(new URL("./AdminWorkspaceNav.tsx", import.meta.url), "utf8");
    expect(nav).toContain('internalOnly: true');
    expect(nav).toContain('role === "internal_admin"');
    expect(nav).toContain('aria-current={selected ? "page" : undefined}');
  });
});
