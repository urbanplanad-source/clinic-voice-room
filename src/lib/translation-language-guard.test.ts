import { describe, expect, it } from "vitest";
import { isClearlyNotKoreanTranslation } from "./translation-language-guard";

describe("isClearlyNotKoreanTranslation", () => {
  it.each([
    ["目を開けてください。", "はい、じゃあ頬のあたりを見てもらいたいんですけど。"],
    ["价格表在哪里？", "好的，我来给您介绍下一项。"],
    ["痛みはありません。", "네、では次の施術について説明します。"],
    ["好", "好"],
    ["Where does it hurt?", "Please tell me where it hurts."],
    ["У меня нет аллергии.", "Хорошо, давайте продолжим."],
    ["เจ็บไหม", "ไม่เจ็บค่ะ"]
  ])("flags foreign output that should have been Korean", (sourceText, translatedText) => {
    expect(isClearlyNotKoreanTranslation(sourceText, translatedText)).toBe(true);
  });

  it.each([
    ["痛みはありません。", "통증은 없습니다."],
    ["Thermage FLX", "써마지 FLX"],
    ["Thermage FLX", "Thermage FLX로 진행합니다."],
    ["Thermage FLX", "Thermage FLX"],
    ["Rejuran 1 cc", "Rejuran 1 cc"]
  ])("keeps Korean or brand-only output", (sourceText, translatedText) => {
    expect(isClearlyNotKoreanTranslation(sourceText, translatedText)).toBe(false);
  });
});
