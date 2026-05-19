import type { PatientLanguage } from "./languages";

export type ConsultationStage = "intake" | "medical" | "procedure" | "price_schedule" | "summary";

export type ConsultationExampleCategory = "visit" | "concern" | "procedure" | "price" | "safety";

export type StaffFollowUpSuggestionSet = {
  label: string;
  suggestions: string[];
};

export type ConsultationRiskFlag = {
  id: string;
  label: string;
  tone: "amber" | "rose" | "blue";
};

export type ClinicConsultationTemplateProfile = {
  id: "plastic_surgery" | "skin_clinic" | "general_dermatology";
  label: string;
  focus: string[];
  priorityTerms: string[];
};

type KeywordSuggestionSet = StaffFollowUpSuggestionSet & {
  stages?: ConsultationStage[];
  keywords: string[];
};

export const consultationStages: Array<{ id: ConsultationStage; label: string; shortLabel: string }> = [
  { id: "intake", label: "접수", shortLabel: "접수" },
  { id: "medical", label: "문진", shortLabel: "문진" },
  { id: "procedure", label: "시술상담", shortLabel: "시술" },
  { id: "price_schedule", label: "가격/예약", shortLabel: "예약" },
  { id: "summary", label: "마무리", shortLabel: "요약" }
];

export const clinicConsultationTemplateProfiles: ClinicConsultationTemplateProfile[] = [
  {
    id: "plastic_surgery",
    label: "성형외과 상담",
    focus: ["수술상담", "마취/복용약", "귀국 일정", "회복 안내"],
    priorityTerms: ["절개", "매몰", "보형물", "수면마취", "실밥제거", "붓기", "멍", "감염"]
  },
  {
    id: "skin_clinic",
    label: "피부과 시술상담",
    focus: ["피부고민", "레이저/리프팅", "스킨부스터", "홈케어"],
    priorityTerms: ["울쎄라", "써마지", "포텐자", "피코레이저", "리쥬란", "쥬베룩", "필러", "보툴리눔 톡신"]
  },
  {
    id: "general_dermatology",
    label: "일반피부 진료상담",
    focus: ["증상 기간", "가려움/통증", "약 복용법", "재내원"],
    priorityTerms: ["피부염", "습진", "두드러기", "항히스타민제", "스테로이드 외용제", "알레르기", "재진 예약"]
  }
];

export function pickClinicConsultationTemplateProfile(hospitalName?: string | null) {
  const normalized = normalizeForMatch(hospitalName ?? "");
  if (normalized.includes("성형") || normalized.includes("plastic") || normalized.includes("surgery")) {
    return clinicConsultationTemplateProfiles[0];
  }
  if (normalized.includes("피부") || normalized.includes("skin") || normalized.includes("derma")) {
    return clinicConsultationTemplateProfiles[1];
  }
  return clinicConsultationTemplateProfiles[2];
}

export const consultationTextCopy: Record<
  PatientLanguage,
  { title: string; placeholder: string; submit: string; chatStarted: string; empty: string; statusChat: string; statusEnded: string }
> = {
  zh: {
    title: "请输入文字",
    placeholder: "请在这里输入您想说的话。",
    submit: "发送翻译",
    chatStarted: "AI 翻译咨询已开始。",
    empty: "请选择下方示例或输入您的问题。",
    statusChat: "咨询中",
    statusEnded: "已结束"
  },
  ja: {
    title: "テキストで入力してください",
    placeholder: "伝えたい内容をここに入力してください。",
    submit: "翻訳を送信",
    chatStarted: "AI翻訳カウンセリングを開始しました。",
    empty: "下の例文を選ぶか、ご質問を入力してください。",
    statusChat: "チャット",
    statusEnded: "終了"
  },
  en: {
    title: "Type your message",
    placeholder: "Type what you want to say here.",
    submit: "Send translation",
    chatStarted: "AI translation consultation has started.",
    empty: "Choose a sample message below or type your question.",
    statusChat: "Chat",
    statusEnded: "Ended"
  },
  ru: {
    title: "Введите сообщение",
    placeholder: "Введите здесь то, что хотите сказать.",
    submit: "Отправить перевод",
    chatStarted: "Консультация с AI-переводом началась.",
    empty: "Выберите пример ниже или введите вопрос.",
    statusChat: "Чат",
    statusEnded: "Завершено"
  },
  vi: {
    title: "Nhập tin nhắn",
    placeholder: "Nhập điều bạn muốn nói ở đây.",
    submit: "Gửi bản dịch",
    chatStarted: "Tư vấn dịch AI đã bắt đầu.",
    empty: "Chọn câu mẫu bên dưới hoặc nhập câu hỏi.",
    statusChat: "Trò chuyện",
    statusEnded: "Đã kết thúc"
  },
  id: {
    title: "Ketik pesan Anda",
    placeholder: "Ketik apa yang ingin Anda sampaikan di sini.",
    submit: "Kirim terjemahan",
    chatStarted: "Konsultasi terjemahan AI telah dimulai.",
    empty: "Pilih contoh di bawah atau ketik pertanyaan Anda.",
    statusChat: "Chat",
    statusEnded: "Selesai"
  },
  fr: {
    title: "Saisissez votre message",
    placeholder: "Écrivez ici ce que vous voulez dire.",
    submit: "Envoyer la traduction",
    chatStarted: "La consultation avec traduction IA a commencé.",
    empty: "Choisissez un exemple ci-dessous ou écrivez votre question.",
    statusChat: "Chat",
    statusEnded: "Terminé"
  },
  es: {
    title: "Escriba su mensaje",
    placeholder: "Escriba aquí lo que quiere decir.",
    submit: "Enviar traducción",
    chatStarted: "La consulta con traducción de IA ha comenzado.",
    empty: "Elija un ejemplo abajo o escriba su pregunta.",
    statusChat: "Chat",
    statusEnded: "Finalizado"
  },
  de: {
    title: "Nachricht eingeben",
    placeholder: "Geben Sie hier ein, was Sie sagen möchten.",
    submit: "Übersetzung senden",
    chatStarted: "Die KI-Übersetzungsberatung hat begonnen.",
    empty: "Wählen Sie unten einen Beispielsatz oder geben Sie Ihre Frage ein.",
    statusChat: "Chat",
    statusEnded: "Beendet"
  },
  it: {
    title: "Scrivi il messaggio",
    placeholder: "Scrivi qui ciò che vuoi dire.",
    submit: "Invia traduzione",
    chatStarted: "La consulenza con traduzione AI è iniziata.",
    empty: "Scegli un esempio qui sotto o scrivi la tua domanda.",
    statusChat: "Chat",
    statusEnded: "Terminato"
  },
  pt: {
    title: "Digite sua mensagem",
    placeholder: "Digite aqui o que você quer dizer.",
    submit: "Enviar tradução",
    chatStarted: "A consulta com tradução por IA começou.",
    empty: "Escolha uma frase abaixo ou digite sua pergunta.",
    statusChat: "Chat",
    statusEnded: "Encerrado"
  }
};

export const consultationDeliveryStatusCopy: Record<PatientLanguage, { sending: string; failed: string }> = {
  zh: { sending: "正在发送", failed: "发送失败" },
  ja: { sending: "送信中", failed: "送信に失敗しました" },
  en: { sending: "Sending", failed: "Send failed" },
  ru: { sending: "Отправка", failed: "Не удалось отправить" },
  vi: { sending: "Đang gửi", failed: "Gửi thất bại" },
  id: { sending: "Mengirim", failed: "Gagal mengirim" },
  fr: { sending: "Envoi", failed: "Échec de l'envoi" },
  es: { sending: "Enviando", failed: "Error al enviar" },
  de: { sending: "Wird gesendet", failed: "Senden fehlgeschlagen" },
  it: { sending: "Invio", failed: "Invio non riuscito" },
  pt: { sending: "Enviando", failed: "Falha ao enviar" }
};

export const stageByExampleCategory: Record<ConsultationExampleCategory, ConsultationStage> = {
  visit: "intake",
  concern: "medical",
  procedure: "procedure",
  price: "price_schedule",
  safety: "medical"
};

export const consultationExampleCategories: Record<
  PatientLanguage,
  Record<ConsultationExampleCategory, { label: string; examples: string[] }>
> = {
  zh: {
    visit: { label: "来院目的", examples: ["我没有预约。今天可以咨询吗？", "如果可以的话，我今天想做治疗。"] },
    concern: { label: "症状/烦恼", examples: ["我想咨询适合我的治疗。", "我有红肿、瘙痒或疼痛。"] },
    procedure: { label: "治疗咨询", examples: ["我想咨询皮肤营养注射。", "我想咨询提升治疗。"] },
    price: { label: "价格/预约", examples: ["我想看完整价目表。", "可以刷卡付款吗？"] },
    safety: { label: "安全确认", examples: ["我正在服药或有过敏史。", "我想知道恢复期，因为我有旅行计划。"] }
  },
  ja: {
    visit: { label: "来院目的", examples: ["予約していません。今日カウンセリングできますか？", "可能であれば今日施術も受けたいです。"] },
    concern: { label: "症状/悩み", examples: ["自分に合う施術を相談したいです。", "赤み、かゆみ、痛みがあります。"] },
    procedure: { label: "施術相談", examples: ["スキンブースターの施術を相談したいです。", "リフティング施術を相談したいです。"] },
    price: { label: "料金/予約", examples: ["全体の料金表を見たいです。", "カードで支払えますか？"] },
    safety: { label: "安全確認", examples: ["服用中の薬、またはアレルギーがあります。", "旅行予定があるので回復期間を知りたいです。"] }
  },
  en: {
    visit: { label: "Visit", examples: ["I don't have an appointment. Can I have a consultation today?", "If possible, I would like treatment today."] },
    concern: { label: "Concern", examples: ["I would like to ask which procedure is suitable for me.", "I have redness, itching, or pain."] },
    procedure: { label: "Procedure", examples: ["I would like to ask about skin booster treatment.", "I would like to ask about lifting treatment."] },
    price: { label: "Price", examples: ["I would like to see the full price list.", "Can I pay by card?"] },
    safety: { label: "Safety", examples: ["I am taking medication or have allergies.", "I need to know the recovery time because of my travel schedule."] }
  },
  ru: {
    visit: { label: "Визит", examples: ["У меня нет записи. Можно пройти консультацию сегодня?", "Если возможно, я хочу пройти процедуру сегодня."] },
    concern: { label: "Жалоба", examples: ["Я хочу узнать, какая процедура мне подходит.", "У меня есть покраснение, зуд или боль."] },
    procedure: { label: "Процедура", examples: ["Я хочу проконсультироваться по поводу скинбустера.", "Я хочу проконсультироваться по поводу лифтинг-процедуры."] },
    price: { label: "Цена", examples: ["Я хочу посмотреть полный прайс-лист.", "Можно оплатить картой?"] },
    safety: { label: "Безопасность", examples: ["Я принимаю лекарства или у меня есть аллергия.", "Мне нужно знать срок восстановления из-за поездки."] }
  },
  vi: {
    visit: { label: "Mục đích", examples: ["Tôi chưa đặt lịch. Hôm nay tôi có thể tư vấn được không?", "Nếu được, tôi muốn làm liệu trình hôm nay."] },
    concern: { label: "Vấn đề", examples: ["Tôi muốn hỏi liệu trình nào phù hợp với mình.", "Tôi bị đỏ, ngứa hoặc đau."] },
    procedure: { label: "Liệu trình", examples: ["Tôi muốn tư vấn về liệu trình skin booster.", "Tôi muốn tư vấn về liệu trình nâng cơ."] },
    price: { label: "Giá", examples: ["Tôi muốn xem bảng giá đầy đủ.", "Tôi có thể thanh toán bằng thẻ không?"] },
    safety: { label: "An toàn", examples: ["Tôi đang dùng thuốc hoặc có dị ứng.", "Tôi cần biết thời gian hồi phục vì lịch du lịch."] }
  },
  id: {
    visit: { label: "Kunjungan", examples: ["Saya belum membuat janji. Apakah saya bisa konsultasi hari ini?", "Jika memungkinkan, saya ingin perawatan hari ini."] },
    concern: { label: "Keluhan", examples: ["Saya ingin bertanya perawatan apa yang cocok untuk saya.", "Saya mengalami kemerahan, gatal, atau nyeri."] },
    procedure: { label: "Perawatan", examples: ["Saya ingin konsultasi tentang perawatan skin booster.", "Saya ingin konsultasi tentang perawatan lifting."] },
    price: { label: "Harga", examples: ["Saya ingin melihat daftar harga lengkap.", "Apakah bisa bayar dengan kartu?"] },
    safety: { label: "Keamanan", examples: ["Saya sedang minum obat atau memiliki alergi.", "Saya perlu tahu masa pemulihan karena jadwal perjalanan."] }
  },
  fr: {
    visit: { label: "Visite", examples: ["Je n'ai pas de rendez-vous. Puis-je avoir une consultation aujourd'hui ?", "Si possible, je voudrais faire un traitement aujourd'hui."] },
    concern: { label: "Problème", examples: ["Je voudrais savoir quel traitement me convient.", "J'ai des rougeurs, des démangeaisons ou une douleur."] },
    procedure: { label: "Traitement", examples: ["Je voudrais me renseigner sur le skin booster.", "Je voudrais me renseigner sur le traitement lifting."] },
    price: { label: "Tarifs", examples: ["Je voudrais voir la liste complète des prix.", "Puis-je payer par carte ?"] },
    safety: { label: "Sécurité", examples: ["Je prends des médicaments ou j'ai des allergies.", "Je dois connaître le temps de récupération à cause de mon voyage."] }
  },
  es: {
    visit: { label: "Visita", examples: ["No tengo cita. ¿Puedo tener una consulta hoy?", "Si es posible, quisiera hacerme un tratamiento hoy."] },
    concern: { label: "Consulta", examples: ["Quisiera saber qué tratamiento es adecuado para mí.", "Tengo enrojecimiento, picazón o dolor."] },
    procedure: { label: "Tratamiento", examples: ["Quisiera consultar sobre el tratamiento skin booster.", "Quisiera consultar sobre el tratamiento lifting."] },
    price: { label: "Precio", examples: ["Quisiera ver la lista completa de precios.", "¿Puedo pagar con tarjeta?"] },
    safety: { label: "Seguridad", examples: ["Estoy tomando medicamentos o tengo alergias.", "Necesito saber el tiempo de recuperación por mi viaje."] }
  },
  de: {
    visit: { label: "Besuch", examples: ["Ich habe keinen Termin. Kann ich heute eine Beratung bekommen?", "Wenn möglich, möchte ich heute eine Behandlung machen."] },
    concern: { label: "Anliegen", examples: ["Ich möchte wissen, welche Behandlung für mich geeignet ist.", "Ich habe Rötung, Juckreiz oder Schmerzen."] },
    procedure: { label: "Behandlung", examples: ["Ich möchte mich zum Skin-Booster beraten lassen.", "Ich möchte mich zu einer Lifting-Behandlung beraten lassen."] },
    price: { label: "Preis", examples: ["Ich möchte die vollständige Preisliste sehen.", "Kann ich mit Karte bezahlen?"] },
    safety: { label: "Sicherheit", examples: ["Ich nehme Medikamente oder habe Allergien.", "Ich muss wegen meiner Reise den Heilungsverlauf kennen."] }
  },
  it: {
    visit: { label: "Visita", examples: ["Non ho un appuntamento. Posso fare una consulenza oggi?", "Se possibile, vorrei fare un trattamento oggi."] },
    concern: { label: "Problema", examples: ["Vorrei sapere quale trattamento è adatto a me.", "Ho rossore, prurito o dolore."] },
    procedure: { label: "Trattamento", examples: ["Vorrei chiedere informazioni sul trattamento skin booster.", "Vorrei chiedere informazioni sul trattamento lifting."] },
    price: { label: "Prezzo", examples: ["Vorrei vedere il listino prezzi completo.", "Posso pagare con carta?"] },
    safety: { label: "Sicurezza", examples: ["Sto assumendo farmaci o ho allergie.", "Devo sapere i tempi di recupero per il mio viaggio."] }
  },
  pt: {
    visit: { label: "Visita", examples: ["Não tenho agendamento. Posso fazer uma consulta hoje?", "Se possível, gostaria de fazer um procedimento hoje."] },
    concern: { label: "Queixa", examples: ["Gostaria de saber qual procedimento é adequado para mim.", "Tenho vermelhidão, coceira ou dor."] },
    procedure: { label: "Procedimento", examples: ["Gostaria de perguntar sobre o tratamento skin booster.", "Gostaria de perguntar sobre o tratamento lifting."] },
    price: { label: "Preço", examples: ["Gostaria de ver a lista completa de preços.", "Posso pagar com cartão?"] },
    safety: { label: "Segurança", examples: ["Estou tomando medicamento ou tenho alergias.", "Preciso saber o tempo de recuperação por causa da viagem."] }
  }
};

const defaultStageSuggestions: Record<ConsultationStage, StaffFollowUpSuggestionSet> = {
  intake: {
    label: "접수 다음 질문",
    suggestions: [
      "오늘은 상담만 원하시나요, 시술까지 원하시나요?",
      "처음 방문이신가요, 재방문이신가요?",
      "상담받고 싶은 부위나 고민을 먼저 알려주세요.",
      "당일 시술을 원하시면 가능 여부를 확인해드리겠습니다."
    ]
  },
  medical: {
    label: "문진 다음 질문",
    suggestions: [
      "현재 복용 중인 약이나 알레르기가 있으신가요?",
      "임신, 수유 중이거나 치료 중인 질환이 있으신가요?",
      "증상이나 고민이 언제부터 있었는지 알려주세요.",
      "이전에 받은 시술이나 치료가 있다면 알려주세요."
    ]
  },
  procedure: {
    label: "시술상담 다음 질문",
    suggestions: [
      "원하시는 효과와 가장 걱정되는 부분을 알려주세요.",
      "다운타임이 짧은 시술을 원하시는지 확인해드릴게요.",
      "같은 시술을 받아보신 적이 있는지 알려주세요.",
      "시술 부위와 범위에 따라 정확한 상담이 필요합니다."
    ]
  },
  price_schedule: {
    label: "가격/예약 다음 질문",
    suggestions: [
      "정확한 비용은 상담 후 시술 범위에 따라 달라질 수 있습니다.",
      "희망하시는 날짜와 시간대를 알려주세요.",
      "카드 결제와 할부 가능 여부를 확인해드리겠습니다.",
      "여행 일정이나 귀국 일정이 있으면 함께 알려주세요."
    ]
  },
  summary: {
    label: "마무리 다음 질문",
    suggestions: [
      "오늘 안내받은 내용 중 더 궁금한 점이 있으실까요?",
      "상담 내용을 요약해서 다시 안내드리겠습니다.",
      "예약을 진행할지, 추후 결정하실지 알려주세요.",
      "시술 후 주의사항이 필요한 경우 따로 안내드리겠습니다."
    ]
  }
};

const keywordSuggestionSets: KeywordSuggestionSet[] = [
  {
    label: "가격 문의 다음 질문",
    stages: ["price_schedule"],
    keywords: ["가격", "비용", "금액", "가격표", "결제", "카드", "현금", "할부", "price", "cost", "pay", "card"],
    suggestions: [
      "어떤 시술의 가격을 확인하고 싶으신가요?",
      "원하시는 부위나 시술명을 알려주시면 더 정확히 안내드릴게요.",
      "상담 후 개인 상태에 따라 최종 비용이 달라질 수 있습니다.",
      "카드 결제와 할부 가능 여부도 함께 확인해드리겠습니다."
    ]
  },
  {
    label: "예약/일정 다음 질문",
    stages: ["intake", "price_schedule"],
    keywords: ["예약", "오늘", "당일", "상담가능", "날짜", "시간", "귀국", "여행", "일정", "appointment", "book", "today", "travel"],
    suggestions: [
      "희망하시는 날짜와 시간대를 알려주세요.",
      "당일 시술을 원하시면 가능 여부를 먼저 확인해드리겠습니다.",
      "귀국 전 재방문이 가능한 일정인지 확인이 필요합니다.",
      "상담받고 싶은 시술이나 고민 부위를 함께 알려주세요."
    ]
  },
  {
    label: "시술 문의 다음 질문",
    stages: ["procedure"],
    keywords: ["시술", "스킨부스터", "리프팅", "보톡스", "필러", "레이저", "제모", "울쎄라", "써마지", "lifting", "booster", "treatment"],
    suggestions: [
      "상담 원하시는 부위가 어디인지 알려주세요.",
      "원하시는 효과나 걱정되는 부분을 알려주시면 더 정확히 상담드릴게요.",
      "이전에 같은 시술을 받아보신 적이 있으신가요?",
      "회복 기간이나 통증에 대해 궁금한 점이 있으실까요?"
    ]
  },
  {
    label: "맞춤 추천 다음 질문",
    stages: ["medical", "procedure"],
    keywords: ["맞는", "추천", "무엇", "어떤", "고민", "피부", "탄력", "주름", "여드름", "기미", "모공", "suitable", "recommend"],
    suggestions: [
      "가장 개선하고 싶은 고민을 하나만 먼저 말씀해주실 수 있을까요?",
      "피부 상태나 고민이 시작된 시기를 알려주세요.",
      "다운타임이 짧은 시술을 원하시는지, 효과 중심 상담을 원하시는지 알려주세요.",
      "예산이나 회복 기간에 대한 선호가 있으실까요?"
    ]
  },
  {
    label: "주의사항 확인 질문",
    stages: ["medical", "summary"],
    keywords: ["알레르기", "복용", "약", "질환", "임신", "수유", "부작용", "통증", "붓기", "멍", "회복", "allergy", "medicine", "pregnant", "pain"],
    suggestions: [
      "현재 복용 중인 약이나 알레르기가 있으신가요?",
      "임신, 수유 중이거나 치료 중인 질환이 있으신가요?",
      "이전 시술 후 불편했던 반응이 있었는지 알려주세요.",
      "통증이나 회복 기간에 대해 가장 걱정되는 부분이 있으실까요?"
    ]
  }
];

const riskDefinitions: Array<ConsultationRiskFlag & { keywords: string[] }> = [
  { id: "medication", label: "복용약/알레르기 확인", tone: "amber", keywords: ["약", "복용", "알레르기", "항응고", "아스피린", "medication", "allergy"] },
  { id: "pregnancy", label: "임신/수유 확인", tone: "rose", keywords: ["임신", "수유", "pregnant", "breastfeeding"] },
  { id: "pain", label: "통증/부작용 확인", tone: "amber", keywords: ["통증", "아파", "부작용", "붓기", "멍", "pain", "side effect"] },
  { id: "price", label: "가격 안내 주의", tone: "blue", keywords: ["가격", "비용", "결제", "할부", "price", "cost", "payment"] },
  { id: "travel", label: "귀국/회복 일정 확인", tone: "blue", keywords: ["귀국", "여행", "호텔", "회복", "일정", "travel", "return"] }
];

function normalizeForMatch(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

export function getStaffFollowUpSuggestionSet(messageText: string | undefined, stage: ConsultationStage) {
  const normalizedText = normalizeForMatch(messageText ?? "");
  const ranked = keywordSuggestionSets
    .map((set) => ({
      set,
      score:
        (set.stages?.includes(stage) ? 1 : 0) +
        set.keywords.reduce((total, keyword) => total + (normalizedText.includes(normalizeForMatch(keyword)) ? 2 : 0), 0)
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score ? ranked[0].set : defaultStageSuggestions[stage];
}

export function getConsultationRiskFlags(text: string | undefined) {
  const normalizedText = normalizeForMatch(text ?? "");
  if (!normalizedText) return [];

  return riskDefinitions
    .filter((definition) => definition.keywords.some((keyword) => normalizedText.includes(normalizeForMatch(keyword))))
    .map((definition) => ({ id: definition.id, label: definition.label, tone: definition.tone }));
}

export function stageLabel(stage: ConsultationStage) {
  return consultationStages.find((item) => item.id === stage)?.label ?? "상담";
}
