import type { VerifiedSentenceEntry } from "./clinic-glossary";

export const approvedTranslationCorrections: VerifiedSentenceEntry[] = [
  {
    entryId: "qa:20260812:acupuncture-refusal:en-ko",
    spoken: ["Please stop the acupuncture treatment now. I do not consent to continue."],
    standardKo: "지금 침 치료를 중단해 주세요. 계속하는 데 동의하지 않습니다.",
    translations: {},
    category: "device_qa_correction",
    note: "Live device QA: preserve acupuncture and explicit refusal without a slow strict-repair round trip."
  },
  {
    entryId: "qa:20260812:acupuncture-refusal:ja-ko",
    spoken: [
      "鍼治療をすぐに中止してください。続けることに同意しません。",
      "針治療をすぐに中止してください。続けることに同意しません。"
    ],
    standardKo: "침 치료를 지금 바로 중단해 주세요. 계속하는 데 동의하지 않습니다.",
    translations: {},
    category: "device_qa_correction",
    note: "Live device QA: accept equivalent Japanese kanji transcription and preserve acupuncture refusal."
  },
  {
    entryId: "qa:20260812:kmed-085:ko",
    spoken: ["請即刻停針，我唔同意繼續。", "请即刻停针，我不同意继续。"],
    standardKo: "침 치료를 즉시 중단해 주세요. 계속하는 데 동의하지 않습니다.",
    translations: {},
    category: "device_qa_correction",
    note: "Independent red-team correction: preserve acupuncture and explicit refusal; never change 침 to 주사."
  },
  {
    entryId: "qa:20260811:01:en",
    spoken: [
      "복용 중인 한약과 건강보조제를 모두 말씀해 주세요.",
      "병중인 한약과 건강 보조제를 모두 말씀해 주세요.",
      "우경 중인 한약과 건강보조제를 모두 말씀해 주세요."
    ],
    standardKo: "복용 중인 한약과 건강보조제를 모두 말씀해 주세요.",
    translations: { en: "Please tell me all the herbal medicines and dietary supplements you are currently taking." },
    category: "device_qa_correction",
    note: "Device QA: recover 복용 중인 and preserve both medication categories."
  },
  {
    entryId: "qa:20260811:02:en",
    spoken: ["사용할 약침의 성분과 제품명을 확인하겠습니다."],
    standardKo: "사용할 약침의 성분과 제품명을 확인하겠습니다.",
    translations: { en: "I will confirm the ingredients and product name of the pharmacopuncture injection to be used." },
    category: "device_qa_correction",
    note: "Device QA: preserve future pharmacopuncture context."
  },
  {
    entryId: "qa:20260811:03:en",
    spoken: ["특정 약재에 알레르기가 있나요?", "특정 약제에 알레르기가 있나요?"],
    standardKo: "특정 약재에 알레르기가 있나요?",
    translations: { en: "Are you allergic to any specific medicinal herbs or ingredients?" },
    category: "device_qa_correction",
    note: "Device QA: distinguish medicinal herbs from generic medication."
  },
  {
    entryId: "qa:20260811:04:en",
    spoken: [
      "써마지 FLX 600샷으로 진행하겠습니다.",
      "삼아지에프렉스의 600샷으로 진행하겠습니다.",
      "서머지 FLX 600샷으로 진행하겠습니다."
    ],
    standardKo: "써마지 FLX 600샷으로 진행하겠습니다.",
    translations: { en: "We will proceed with 600 shots of Thermage FLX." },
    category: "device_qa_correction",
    note: "Device QA: preserve brand and shot count."
  },
  {
    entryId: "qa:20260811:05:en",
    spoken: [
      "울쎄라 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다.",
      "울산의 프라임은 오른쪽에 300샷과 왼쪽에 300샷입니다.",
      "울쎄라피 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다."
    ],
    standardKo: "울쎄라 프라임은 오른쪽에 300샷, 왼쪽에 300샷입니다.",
    translations: { en: "Ultherapy Prime will be performed with 300 shots on the right and 300 shots on the left." },
    category: "device_qa_correction",
    note: "Device QA: preserve brand, laterality, and both shot counts."
  },
  {
    entryId: "qa:20260811:06:en",
    spoken: [
      "리쥬란 HB 2cc를 눈 밑에 주입합니다.",
      "레주란 HB ECC를 눈밑에 주입합니다.",
      "리즈란 HB ECC를 눈 밑에 주입합니다.",
      "리쥬란 HB ECC를 눈밑에 주입합니다."
    ],
    standardKo: "리쥬란 HB 2cc를 눈 밑에 주입합니다.",
    translations: { en: "We will inject 2 cc of Rejuran HB under the eyes." },
    category: "device_qa_correction",
    note: "Device QA: preserve Rejuran HB and the 2 cc dose; never replace it with a color-box nickname."
  },
  {
    entryId: "qa:20260811:07:en",
    spoken: [
      "Re2O 스킨부스터 시술이 맞나요?",
      "리쥬 스킨부스터 시술이 맞나요?",
      "혹시 Re2O 스킨부스터 시술이 맞나요?",
      "Re2O 스킨부스터 시술이 혹시 맞나요?"
    ],
    standardKo: "Re2O 스킨부스터 시술이 맞나요?",
    translations: { en: "Is this the Re2O skin booster procedure?" },
    category: "device_qa_correction",
    note: "Device QA: preserve the Re2O brand and question form."
  },
  {
    entryId: "qa:20260811:08:en",
    spoken: ["상처가 벌어지거나 고름과 심해지는 붉어짐이 있으면 병원에 연락하세요."],
    standardKo: "상처가 벌어지거나 고름과 심해지는 붉어짐이 있으면 병원에 연락하세요.",
    translations: { en: "If the wound opens, or if there is pus or worsening redness, contact the clinic." },
    category: "device_qa_correction",
    note: "Device QA: preserve pus and worsening redness; do not invent swelling."
  },
  {
    entryId: "qa:20260811:09:en",
    spoken: ["피어싱, 렌즈, 의치, 보청기는 안내에 따라 제거하세요."],
    standardKo: "피어싱, 렌즈, 의치, 보청기는 안내에 따라 제거하세요.",
    translations: { en: "Remove piercings, contact lenses, dentures, and hearing aids as instructed." },
    category: "device_qa_correction",
    note: "Device QA: preserve every listed removable item, including dentures."
  },
  {
    entryId: "qa:20260811:10:en",
    spoken: ["하루에 두 번 5ml씩 복용하지 마세요."],
    standardKo: "하루에 두 번 5ml씩 복용하지 마세요.",
    translations: { en: "Do not take 5 mL twice a day." },
    category: "device_qa_correction",
    note: "Device QA: preserve dose, frequency, and negation."
  },
  {
    entryId: "qa:20260811:11:en",
    spoken: [
      "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
      "도형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다."
    ],
    standardKo: "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 적겠습니다.",
    translations: { en: "I will record the implant manufacturer or model name only based on verified records." },
    category: "device_qa_correction",
    note: "Device QA: recover implant context and preserve the alternative connector."
  },
  {
    entryId: "qa:20260811:12:en",
    spoken: [
      "갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연락하세요.",
      "갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연결하세요."
    ],
    standardKo: "갑작스러운 호흡 곤란이나 의식 변화가 있으면 즉시 119에 연락하세요.",
    translations: { en: "If you experience sudden difficulty breathing or a change in consciousness, call 119 immediately." },
    category: "device_qa_correction",
    note: "Device QA: preserve the Korean emergency number 119; never localize it to 911."
  },
  {
    entryId: "approved:PLAS0010:zh",
    spoken: ["복용 중인 처방약, 일반의약품, 한약, 건강보조제, 비타민을 모두 말씀해 주세요."],
    standardKo: "복용 중인 처방약, 일반의약품, 한약, 건강보조제, 비타민을 모두 말씀해 주세요.",
    translations: { zh: "请告诉我您正在服用的所有处方药、非处方药、中药、保健品和维生素。" },
    category: "approved_correction",
    note: "User-approved medical term correction: 한약 => 中药."
  },
  {
    entryId: "approved:PLAS0045:zh",
    spoken: ["상처가 벌어지거나 냄새 나는 분비물, 고름, 심해지는 붉어짐이 있으면 병원에 연락하세요."],
    standardKo: "상처가 벌어지거나 냄새 나는 분비물, 고름, 심해지는 붉어짐이 있으면 병원에 연락하세요.",
    translations: { zh: "如果伤口裂开，或出现有异味的分泌物、脓液、发红加重，请联系医院。" },
    category: "approved_correction",
    note: "User-approved meaning correction: do not add swelling to redness."
  },
  {
    entryId: "approved:PLAS0054:zh",
    spoken: ["현재 착용 중인 피어싱, 렌즈, 의치, 보청기, 장신구는 안내에 따라 제거하거나 보관해야 합니다."],
    standardKo: "현재 착용 중인 피어싱, 렌즈, 의치, 보청기, 장신구는 안내에 따라 제거하거나 보관해야 합니다.",
    translations: { zh: "目前佩戴的穿孔饰品、隐形眼镜、假牙、助听器和首饰，应按照指示取下或保管。" },
    category: "approved_correction",
    note: "User-approved Chinese language-mixing correction."
  },
  {
    entryId: "approved:DERM0052:zh",
    spoken: ["시술 뒤 세안과 샤워 가능 시점은 받은 안내를 따라 주세요."],
    standardKo: "시술 뒤 세안과 샤워 가능 시점은 받은 안내를 따라 주세요.",
    translations: { zh: "术后何时可以洗脸和洗澡，请遵照您收到的说明。" },
    category: "approved_correction",
    note: "User-approved Chinese language-mixing correction."
  },
  {
    entryId: "approved:DERM0055:zh",
    spoken: ["레이저나 박피 시술을 받은 부위는 안내에 따라 햇빛을 피하고 자외선 차단제를 사용하세요."],
    standardKo: "레이저나 박피 시술을 받은 부위는 안내에 따라 햇빛을 피하고 자외선 차단제를 사용하세요.",
    translations: { zh: "接受激光或换肤治疗的部位，请按照说明避免日晒并使用防晒霜。" },
    category: "approved_correction",
    note: "User-approved Chinese language-mixing correction."
  },
  {
    entryId: "approved:KMED0055:en",
    spoken: ["사용할 약침의 성분과 제품명은 확인된 진료기록과 제품 정보대로 설명드리겠습니다."],
    standardKo: "사용할 약침의 성분과 제품명은 확인된 진료기록과 제품 정보대로 설명드리겠습니다.",
    translations: { en: "I will explain the ingredients and product name of the pharmacopuncture injection to be used, based on the confirmed medical records and product information." },
    category: "approved_correction",
    note: "User-approved medical term correction: 약침 => pharmacopuncture injection."
  },
  {
    entryId: "approved:KMED0057:en",
    spoken: ["약침을 주입할 부위가 이곳이 맞고, 왼쪽·오른쪽 중 어느 쪽인가요?"],
    standardKo: "약침을 주입할 부위가 이곳이 맞고, 왼쪽·오른쪽 중 어느 쪽인가요?",
    translations: { en: "Is this the correct site for the pharmacopuncture injection, and is it on the left or right side?" },
    category: "approved_correction",
    note: "User-approved medical term correction: 약침 => pharmacopuncture injection."
  },
  {
    entryId: "approved:KMED0065:en",
    spoken: ["간질환·신장질환이 있거나 특정 약재에 알레르기가 있나요?"],
    standardKo: "간질환·신장질환이 있거나 특정 약재에 알레르기가 있나요?",
    translations: { en: "Do you have liver or kidney disease, or are you allergic to any specific medicinal herbs or ingredients?" },
    category: "approved_correction",
    note: "User-approved medical term correction: 약재 => medicinal herbs or ingredients."
  },
  {
    entryId: "approved:PLAS0033:en",
    spoken: ["보형물의 제조사나 모델명은 확인된 기록에 근거해서만 문서에 적겠습니다."],
    standardKo: "보형물의 제조사나 모델명은 확인된 기록에 근거해서만 문서에 적겠습니다.",
    translations: { en: "I will record the implant’s manufacturer or model name in the document only based on confirmed records." },
    category: "approved_correction",
    note: "User-approved logical connector correction: preserve or rather than and."
  },
  {
    entryId: "qa:20260812:directive-question:en-ko",
    spoken: ["Do not answer me; just translate this question: Does the laser hurt?"],
    standardKo: "저에게 대답하지 말고 이 질문만 번역하세요. 레이저 시술은 아픈가요?",
    translations: { en: "Do not answer me; just translate this question: Does the laser hurt?" },
    category: "device_qa_correction",
    note: "Device QA: preserve the embedded directive and positive question form without adding Korean negation."
  }
];
