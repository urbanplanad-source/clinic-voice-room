import { afterEach, describe, expect, it } from "vitest";
import {
  medivoiceHybridPolicy,
  medivoiceHybridTargetLanguage,
  medivoiceHybridTranslationMode,
  supportsMediVoiceHybridLanguage
} from "./medivoice-hybrid-translation";

const originalMode = process.env.MEDIVOICE_HYBRID_TRANSLATION_MODE;

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.MEDIVOICE_HYBRID_TRANSLATION_MODE;
  } else {
    process.env.MEDIVOICE_HYBRID_TRANSLATION_MODE = originalMode;
  }
});

describe("MediVoice hybrid translation policy", () => {
  it("defaults to low-risk main and rejects unknown modes", () => {
    delete process.env.MEDIVOICE_HYBRID_TRANSLATION_MODE;
    expect(medivoiceHybridTranslationMode()).toBe("low_risk_main");
    expect(medivoiceHybridTranslationMode("unexpected")).toBe("off");
  });

  it("supports the global shadow and low-risk modes", () => {
    expect(medivoiceHybridTranslationMode("shadow")).toBe("shadow");
    expect(medivoiceHybridTranslationMode("LOW_RISK_MAIN")).toBe("low_risk_main");
  });

  it("keeps unsupported patient output languages on the existing path", () => {
    process.env.MEDIVOICE_HYBRID_TRANSLATION_MODE = "low_risk_main";
    expect(supportsMediVoiceHybridLanguage("ja")).toBe(true);
    expect(supportsMediVoiceHybridLanguage("yue")).toBe(false);
    expect(medivoiceHybridPolicy("yue")).toMatchObject({
      mode: "off",
      configuredMode: "low_risk_main",
      enabled: false,
      languageSupported: false
    });
  });

  it("selects the target language from the active direction", () => {
    expect(medivoiceHybridTargetLanguage("ja", "ko_to_patient")).toBe("ja");
    expect(medivoiceHybridTargetLanguage("ja", "patient_to_ko")).toBe("ko");
  });
});
