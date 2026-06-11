import type { HospitalSpecialty } from "@prisma/client";

export type VerifiedSentenceSeedEntry = {
  specialty: HospitalSpecialty;
  spoken: string[];
  standardKo: string;
  translations: Record<string, string>;
  category: string;
  note: string;
};

const reviewNote = "Verified sentence starter. Operator medical review required before enabling.";

export const verifiedSentenceSeedEntries: VerifiedSentenceSeedEntry[] = [
  {
    specialty: "dermatology",
    spoken: ["레이저시술후 일주일간 사우나는 피해주세요", "레이저 시술 후 1주일간 사우나는 피해주세요"],
    standardKo: "레이저 시술 후 일주일간 사우나는 피해주세요.",
    translations: {
      zh: "激光治疗后一周内请避免桑拿。",
      ja: "レーザー施術後1週間はサウナを避けてください。",
      en: "Please avoid saunas for one week after the laser treatment.",
      th: "โปรดหลีกเลี่ยงการอบซาวน่าเป็นเวลา 1 สัปดาห์หลังการทำเลเซอร์"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["시술 부위는 오늘 세게 문지르지 마세요"],
    standardKo: "시술 부위는 오늘 세게 문지르지 마세요.",
    translations: {
      zh: "今天请不要用力揉搓治疗部位。",
      ja: "本日は施術部位を強くこすらないでください。",
      en: "Please do not rub the treated area hard today.",
      th: "วันนี้โปรดอย่าถูบริเวณที่ทำหัตถการแรง ๆ"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["붉어짐과 열감은 일시적으로 생길 수 있습니다"],
    standardKo: "붉어짐과 열감은 일시적으로 생길 수 있습니다.",
    translations: {
      zh: "可能会暂时出现发红和发热感。",
      ja: "赤みやほてりが一時的に出ることがあります。",
      en: "Redness and a warm sensation may occur temporarily.",
      th: "อาจมีรอยแดงและความรู้สึกร้อนเกิดขึ้นชั่วคราวได้"
    },
    category: "side_effect",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["피부가 건조할 수 있으니 보습제를 충분히 발라주세요"],
    standardKo: "피부가 건조할 수 있으니 보습제를 충분히 발라주세요.",
    translations: {
      zh: "皮肤可能会干燥，请充分涂抹保湿霜。",
      ja: "肌が乾燥することがあるため、保湿剤を十分に塗ってください。",
      en: "Your skin may feel dry, so please apply enough moisturizer.",
      th: "ผิวอาจแห้งได้ โปรดทามอยส์เจอไรเซอร์ให้เพียงพอ"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["외출 시 자외선 차단제를 꼭 발라주세요"],
    standardKo: "외출 시 자외선 차단제를 꼭 발라주세요.",
    translations: {
      zh: "外出时请务必涂抹防晒霜。",
      ja: "外出時は必ず日焼け止めを塗ってください。",
      en: "Please be sure to apply sunscreen when going outside.",
      th: "เมื่อออกไปข้างนอก โปรดทาครีมกันแดดทุกครั้ง"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["딱지가 생기면 억지로 떼지 마세요"],
    standardKo: "딱지가 생기면 억지로 떼지 마세요.",
    translations: {
      zh: "如果结痂，请不要强行剥掉。",
      ja: "かさぶたができても無理にはがさないでください。",
      en: "If scabs form, please do not pick them off.",
      th: "หากมีสะเก็ดแผล โปรดอย่าแกะออก"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["오늘은 음주를 피해주세요"],
    standardKo: "오늘은 음주를 피해주세요.",
    translations: {
      zh: "今天请避免饮酒。",
      ja: "本日は飲酒を避けてください。",
      en: "Please avoid alcohol today.",
      th: "วันนี้โปรดหลีกเลี่ยงการดื่มแอลกอฮอล์"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["임신 중이거나 수유 중이신가요"],
    standardKo: "임신 중이거나 수유 중이신가요?",
    translations: {
      zh: "您现在是否怀孕或正在哺乳？",
      ja: "現在、妊娠中または授乳中ですか？",
      en: "Are you pregnant or breastfeeding?",
      th: "คุณกำลังตั้งครรภ์หรือให้นมบุตรอยู่หรือไม่"
    },
    category: "contraindication",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["최근 복용 중인 약이 있으신가요"],
    standardKo: "최근 복용 중인 약이 있으신가요?",
    translations: {
      zh: "您最近有正在服用的药物吗？",
      ja: "最近服用している薬はありますか？",
      en: "Are you currently taking any medications?",
      th: "ขณะนี้คุณมียาที่รับประทานอยู่หรือไม่"
    },
    category: "contraindication",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["알레르기나 이전 부작용 경험이 있으신가요"],
    standardKo: "알레르기나 이전 부작용 경험이 있으신가요?",
    translations: {
      zh: "您是否有过敏或以往副作用的经历？",
      ja: "アレルギーや過去の副作用の経験はありますか？",
      en: "Do you have any allergies or previous side effect history?",
      th: "คุณมีอาการแพ้หรือเคยมีผลข้างเคียงมาก่อนหรือไม่"
    },
    category: "contraindication",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["통증이 심하면 바로 말씀해주세요"],
    standardKo: "통증이 심하면 바로 말씀해주세요.",
    translations: {
      zh: "如果疼痛明显，请立刻告诉我们。",
      ja: "痛みが強い場合はすぐにお知らせください。",
      en: "Please tell us right away if the pain is severe.",
      th: "หากปวดมาก โปรดแจ้งเราทันที"
    },
    category: "pain_safety",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["시술 후 이상 반응이 있으면 병원으로 연락해주세요"],
    standardKo: "시술 후 이상 반응이 있으면 병원으로 연락해주세요.",
    translations: {
      zh: "治疗后如有异常反应，请联系医院。",
      ja: "施術後に異常な反応があれば、病院へご連絡ください。",
      en: "Please contact the clinic if you have any unusual reaction after the procedure.",
      th: "หากมีอาการผิดปกติหลังทำหัตถการ โปรดติดต่อโรงพยาบาล"
    },
    category: "side_effect",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["마취 크림을 바르고 기다리겠습니다"],
    standardKo: "마취 크림을 바르고 기다리겠습니다.",
    translations: {
      zh: "我们会涂抹麻醉膏后等待。",
      ja: "麻酔クリームを塗ってからお待ちいただきます。",
      en: "We will apply numbing cream and wait.",
      th: "เราจะทายาชาแบบครีมแล้วรอสักครู่"
    },
    category: "procedure",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["시술 전 사진 촬영을 진행하겠습니다"],
    standardKo: "시술 전 사진 촬영을 진행하겠습니다.",
    translations: {
      zh: "我们将进行治疗前拍照。",
      ja: "施術前の写真撮影を行います。",
      en: "We will take photos before the procedure.",
      th: "เราจะถ่ายภาพก่อนทำหัตถการ"
    },
    category: "procedure",
    note: reviewNote
  },
  {
    specialty: "dermatology",
    spoken: ["설명 들으신 내용에 동의하시면 서명해주세요"],
    standardKo: "설명 들으신 내용에 동의하시면 서명해주세요.",
    translations: {
      zh: "如果您同意刚才说明的内容，请签名。",
      ja: "説明を受けた内容に同意される場合は署名してください。",
      en: "Please sign if you agree with the explanation you received.",
      th: "หากคุณยินยอมตามคำอธิบายที่ได้รับ โปรดลงชื่อ"
    },
    category: "consent",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["수술 후 일주일간 음주와 흡연은 피해주세요"],
    standardKo: "수술 후 일주일간 음주와 흡연은 피해주세요.",
    translations: {
      zh: "手术后一周内请避免饮酒和吸烟。",
      ja: "手術後1週間は飲酒と喫煙を避けてください。",
      en: "Please avoid alcohol and smoking for one week after surgery.",
      th: "หลังผ่าตัด 1 สัปดาห์ โปรดหลีกเลี่ยงการดื่มแอลกอฮอล์และสูบบุหรี่"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["붓기와 멍은 시간이 지나면서 서서히 좋아집니다"],
    standardKo: "붓기와 멍은 시간이 지나면서 서서히 좋아집니다.",
    translations: {
      zh: "肿胀和淤青会随着时间逐渐好转。",
      ja: "腫れや内出血は時間とともに徐々に改善します。",
      en: "Swelling and bruising will gradually improve over time.",
      th: "อาการบวมและรอยช้ำจะค่อย ๆ ดีขึ้นตามเวลา"
    },
    category: "side_effect",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["실밥 제거 일정에 맞춰 내원해주세요"],
    standardKo: "실밥 제거 일정에 맞춰 내원해주세요.",
    translations: {
      zh: "请按拆线预约时间来院。",
      ja: "抜糸の予定に合わせてご来院ください。",
      en: "Please visit the clinic according to your stitch removal schedule.",
      th: "โปรดมาตามนัดสำหรับการตัดไหม"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["수술 부위를 손으로 만지지 마세요"],
    standardKo: "수술 부위를 손으로 만지지 마세요.",
    translations: {
      zh: "请不要用手触摸手术部位。",
      ja: "手術部位を手で触らないでください。",
      en: "Please do not touch the surgical area with your hands.",
      th: "โปรดอย่าใช้มือสัมผัสบริเวณผ่าตัด"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["처방받은 약은 안내대로 복용해주세요"],
    standardKo: "처방받은 약은 안내대로 복용해주세요.",
    translations: {
      zh: "请按说明服用处方药。",
      ja: "処方された薬は案内どおりに服用してください。",
      en: "Please take the prescribed medication as instructed.",
      th: "โปรดรับประทานยาตามที่ได้รับคำแนะนำ"
    },
    category: "aftercare",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["출혈이 계속되면 바로 병원으로 연락해주세요"],
    standardKo: "출혈이 계속되면 바로 병원으로 연락해주세요.",
    translations: {
      zh: "如果持续出血，请立即联系医院。",
      ja: "出血が続く場合はすぐに病院へご連絡ください。",
      en: "Please contact the clinic immediately if bleeding continues.",
      th: "หากมีเลือดออกต่อเนื่อง โปรดติดต่อโรงพยาบาลทันที"
    },
    category: "pain_safety",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["수술 전 금식 시간을 지켜주세요"],
    standardKo: "수술 전 금식 시간을 지켜주세요.",
    translations: {
      zh: "请遵守手术前禁食时间。",
      ja: "手術前の絶食時間を守ってください。",
      en: "Please follow the fasting time before surgery.",
      th: "โปรดปฏิบัติตามเวลางดอาหารก่อนผ่าตัด"
    },
    category: "procedure",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["복용 중인 항응고제가 있으신가요"],
    standardKo: "복용 중인 항응고제가 있으신가요?",
    translations: {
      zh: "您目前有服用抗凝血药吗？",
      ja: "現在服用している抗凝固薬はありますか？",
      en: "Are you taking any anticoagulant medication?",
      th: "คุณกำลังรับประทานยาต้านการแข็งตัวของเลือดอยู่หรือไม่"
    },
    category: "contraindication",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["마취에 이상 반응이 있었던 적이 있으신가요"],
    standardKo: "마취에 이상 반응이 있었던 적이 있으신가요?",
    translations: {
      zh: "您曾经对麻醉有过异常反应吗？",
      ja: "麻酔で異常反応が出たことはありますか？",
      en: "Have you ever had an unusual reaction to anesthesia?",
      th: "คุณเคยมีอาการผิดปกติต่อยาชาหรือยาสลบหรือไม่"
    },
    category: "contraindication",
    note: reviewNote
  },
  {
    specialty: "plastic_surgery",
    spoken: ["설명 들으신 수술 내용에 동의하시면 서명해주세요"],
    standardKo: "설명 들으신 수술 내용에 동의하시면 서명해주세요.",
    translations: {
      zh: "如果您同意刚才说明的手术内容，请签名。",
      ja: "説明を受けた手術内容に同意される場合は署名してください。",
      en: "Please sign if you agree with the surgical explanation you received.",
      th: "หากคุณยินยอมตามคำอธิบายเกี่ยวกับการผ่าตัด โปรดลงชื่อ"
    },
    category: "consent",
    note: reviewNote
  }
];
