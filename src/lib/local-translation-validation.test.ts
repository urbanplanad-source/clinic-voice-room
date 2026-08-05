import { describe, expect, it } from "vitest";
import {
  buildLocalTranslationValidationInstructions,
  hasMandatoryStaffTranslationRisk,
  parseLocalTranslationValidationResult,
  resolveLocalTranslation
} from "./local-translation-validation";

describe("local translation validation", () => {
  it("keeps a valid candidate unchanged", () => {
    const validation = parseLocalTranslationValidationResult(
      JSON.stringify({ ok: true, reason: "", correctedTranslation: "" })
    );

    expect(validation).not.toBeNull();
    expect(resolveLocalTranslation("전체 항목의 가격표가 있나요?", validation!)).toEqual({
      translatedText: "전체 항목의 가격표가 있나요?",
      repaired: false
    });
  });

  it("replaces a generated reply with a direct translation", () => {
    const validation = parseLocalTranslationValidationResult(
      JSON.stringify({
        ok: false,
        reason: "The question was changed into an answer.",
        correctedTranslation: "전체 항목의 가격표가 있나요?"
      })
    );

    expect(validation).not.toBeNull();
    expect(
      resolveLocalTranslation(
        "네, 전체 시술 항목의 가격표를 보고 싶으시군요. 잠시만요, 지금 보여드리겠습니다.",
        validation!
      )
    ).toEqual({
      translatedText: "전체 항목의 가격표가 있나요?",
      repaired: true
    });
  });

  it("requires a parseable boolean verdict", () => {
    expect(parseLocalTranslationValidationResult('{"reason":"missing verdict"}')).toBeNull();
    expect(parseLocalTranslationValidationResult("not json")).toBeNull();
  });

  it("does not call an unchanged invalid candidate repaired", () => {
    expect(
      resolveLocalTranslation("가격표가 있나요?", {
        ok: false,
        reason: "repair missing",
        correctedTranslation: "가격표가 있나요?"
      })
    ).toEqual({
      translatedText: "가격표가 있나요?",
      repaired: false
    });
  });

  it("keeps routine procedure and anesthesia phrases out of mandatory risk", () => {
    const routinePhrases = [
      "리프팅 시술전에 연고마취가 필요해요",
      "이제 시술 시작할게요",
      "이쪽으로 오시면 연고 마취 도와드릴게요",
      "30분 동안 연고 마취할게요",
      "한방",
      "한방 치료",
      "한의학",
      "한의원",
      "한방기반의 스킨 부스터",
      "한의학 기반의 스킨 부스터",
      "이 원장님이 상담해 드릴게요",
      "이 원장님께 확인해 볼게요",
      "오 원장님을 기다려 주세요",
      "오원석 원장님이 진료합니다",
      "이원입니다",
      "삼원입니다",
      "이원 선생님께 안내받으세요",
      "삼원색 레이저가 아닙니다",
      "병원에서 지원해 드립니다",
      "원하시는 부위를 말씀해 주세요",
      "Please pay attention to the treatment area.",
      "Please pay attention when standing up.",
      "You won't feel much pain.",
      "You won’t need anesthesia.",
      "This is a cost-effective treatment.",
      "This is cost effective.",
      "기계가 더 이상 반응하지 않습니다.",
      "그 이상 반응하지 않도록 강도를 조절할게요.",
      "Dr. Yuan will see you.",
      "Please wait for Ms. Yen.",
      "Avoid touching it at all costs.",
      "1cc 사용합니다",
      "2주 후에 내원해 주세요",
      "알레르기가 있는지 말씀해 주세요",
      "임신 중인지 확인해 주세요",
      "동의서를 작성해 주세요",
      "다음 주 화요일 오전 10시에 오세요",
      "2주에 한 번씩 주사를 맞아야 합니다",
      "1cc만 주입할게요",
      "하루에 두 번 복용하세요",
      "임신 중에는 시술하지 않습니다",
      "이 약은 복용하지 마세요",
      "절대 문지르지 마세요",
      "눈을 감지 마세요",
      "통증이 있으면 말씀해 주세요",
      "이상으로 설명을 마칠게요",
      "피부 반응이 좋습니다",
      "반응이 이상적입니다",
      "원래 약간 붉어질 수 있습니다",
      "회원 등록을 도와드릴게요"
    ];

    for (const phrase of routinePhrases) {
      expect(hasMandatoryStaffTranslationRisk(phrase), phrase).toBe(false);
    }
  });

  it("keeps routine translations across all supported languages out of mandatory risk", () => {
    const translations = [
      "现在开始治疗。",
      "而家開始療程。",
      "現在開始療程。",
      "これから施術を始めます。",
      "We will start the treatment now.",
      "ตอนนี้เราจะเริ่มการรักษา",
      "Bây giờ chúng ta sẽ bắt đầu liệu trình.",
      "Kami akan memulai perawatan sekarang.",
      "Kami akan memulakan rawatan sekarang.",
      "Sisimulan na natin ang procedure.",
      "Одоо эмчилгээг эхэлье.",
      "Сейчас начнем процедуру.",
      "Nous allons commencer le traitement.",
      "Ahora comenzaremos el tratamiento.",
      "Wir beginnen jetzt mit der Behandlung.",
      "Ora inizieremo il trattamento.",
      "Vamos iniciar o procedimento agora.",
      "Please stay by my side.",
      "The treatment is effective.",
      "This effect is temporary.",
      "The skin reacted well."
    ];

    for (const translation of translations) {
      expect(hasMandatoryStaffTranslationRisk(translation), translation).toBe(false);
    }
  });

  it("keeps only amount and side-effect staff phrases in mandatory risk", () => {
    expect(hasMandatoryStaffTranslationRisk("써마지 가격은 300만원입니다.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("시술비는 3억 원입니다.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("마취 비용은 3천 원입니다.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("시술비는 3천5백원입니다.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("시술비는 3억5천만원입니다.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("총액은 삼백만 원입니다.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("300만 원을 결제해 주세요.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("결제 금액을 안내해 드릴게요.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("Please pay by card.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("부작용으로 붓기가 있을 수 있습니다.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("이상 반응이 나타나면 연락해 주세요.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("피부 반응이 이상하면 바로 말씀해 주세요.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("異常な反応が出たらご連絡ください。")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("出现异常反应时请联系我们。")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("An abnormal reaction may occur.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("料金は300万ウォンです。")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("副作用が生じる可能性があります。")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("The price is 3,000,000 won.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("진료비를 안내해 드릴게요.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("할인 적용 후 결제해 주세요.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("施術料は三百万円です。")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("治疗费是三百万元。")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("The fee is three million won.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("You can pay in yen.")).toBe(true);
    expect(hasMandatoryStaffTranslationRisk("써마지 600샷으로 진행합니다.")).toBe(false);
  });

  it("explicitly forbids answering the speaker", () => {
    const instructions = buildLocalTranslationValidationInstructions({
      sourceLanguage: "Traditional Chinese",
      targetLanguage: "Korean"
    });

    expect(instructions).toContain("questions must remain questions");
    expect(instructions).toContain("Never answer the source speaker");
    expect(instructions).toContain("fluent, plausible clinic sentence");
    expect(instructions).toContain("目を開けてください。");
    expect(instructions).toContain("눈을 떠 주세요.");
    expect(instructions).toContain("correctedTranslation");
  });
});
