import type { PatientLanguage } from "./languages";

export type ConsultationStage = "intake" | "medical" | "procedure" | "price_schedule" | "summary";

export type ConsultationExampleCategory = "visit" | "concern" | "procedure" | "price" | "safety";

export type StaffFollowUpSuggestionSet = {
  label: string;
  suggestions: string[];
};

export type PatientFollowUpSuggestionSet = {
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

type ConsultationTextCopy = {
  title: string;
  placeholder: string;
  submit: string;
  chatStarted: string;
  empty: string;
  statusChat: string;
  statusEnded: string;
};

type DeliveryStatusCopy = { sending: string; failed: string; read: string };

export const consultationTextCopy: Partial<Record<PatientLanguage, ConsultationTextCopy>> & { en: ConsultationTextCopy; zh_tw: ConsultationTextCopy } = {
  zh: {
    title: "点击下方按钮说话",
    placeholder: "请在这里输入您想说的话。",
    submit: "发送翻译",
    chatStarted: "AI 翻译咨询已开始。",
    empty: "您可以用语音咨询，也可以在下方输入文字。",
    statusChat: "咨询中",
    statusEnded: "已结束"
  },
  yue: {
    title: "點擊下方按鈕講話",
    placeholder: "請在這裡輸入您想講的內容。",
    submit: "送出翻譯",
    chatStarted: "AI 翻譯諮詢已開始。",
    empty: "您可以用語音諮詢，也可以在下方輸入文字。",
    statusChat: "諮詢中",
    statusEnded: "已結束"
  },
  zh_tw: {
    title: "點擊下方按鈕說話",
    placeholder: "請在這裡輸入您想說的內容。",
    submit: "送出翻譯",
    chatStarted: "AI 翻譯諮詢已開始。",
    empty: "您可以用語音諮詢，也可以在下方輸入文字。",
    statusChat: "諮詢中",
    statusEnded: "已結束"
  },
  ja: {
    title: "下のボタンを押して話してください",
    placeholder: "伝えたい内容をここに入力してください。",
    submit: "翻訳を送信",
    chatStarted: "AI翻訳カウンセリングを開始しました。",
    empty: "音声で相談できます。必要な場合は下の入力欄も使えます。",
    statusChat: "チャット",
    statusEnded: "終了"
  },
  en: {
    title: "Tap the button below and speak",
    placeholder: "Type what you want to say here.",
    submit: "Send translation",
    chatStarted: "AI translation consultation has started.",
    empty: "You can consult by voice, or type below if needed.",
    statusChat: "Chat",
    statusEnded: "Ended"
  },
  th: {
    title: "แตะปุ่มด้านล่างแล้วพูด",
    placeholder: "พิมพ์สิ่งที่ต้องการบอกที่นี่",
    submit: "ส่งคำแปล",
    chatStarted: "เริ่มการปรึกษาพร้อมแปลด้วย AI แล้ว",
    empty: "คุณสามารถปรึกษาด้วยเสียง หรือพิมพ์ด้านล่างได้เมื่อจำเป็น",
    statusChat: "แชท",
    statusEnded: "สิ้นสุด"
  },
  ms: {
    title: "Ketik butang di bawah dan bercakap",
    placeholder: "Taip perkara yang ingin anda sampaikan di sini.",
    submit: "Hantar terjemahan",
    chatStarted: "Konsultasi terjemahan AI telah bermula.",
    empty: "Anda boleh berkonsultasi melalui suara, atau menaip di bawah jika perlu.",
    statusChat: "Chat",
    statusEnded: "Tamat"
  },
  mn: {
    title: "Доорх товчийг дарж ярина уу",
    placeholder: "Хэлэхийг хүссэн зүйлээ энд бичнэ үү.",
    submit: "Орчуулга илгээх",
    chatStarted: "AI орчуулгатай зөвлөгөө эхэллээ.",
    empty: "Та дуугаар зөвлөгөө авч болно. Шаардлагатай бол доор бичнэ үү.",
    statusChat: "Чат",
    statusEnded: "Дууссан"
  },
  ru: {
    title: "Нажмите кнопку ниже и говорите",
    placeholder: "Введите здесь то, что хотите сказать.",
    submit: "Отправить перевод",
    chatStarted: "Консультация с AI-переводом началась.",
    empty: "Можно консультироваться голосом или ввести текст ниже при необходимости.",
    statusChat: "Чат",
    statusEnded: "Завершено"
  },
  vi: {
    title: "Nhấn nút bên dưới và nói",
    placeholder: "Nhập điều bạn muốn nói ở đây.",
    submit: "Gửi bản dịch",
    chatStarted: "Tư vấn dịch AI đã bắt đầu.",
    empty: "Bạn có thể tư vấn bằng giọng nói hoặc nhập chữ bên dưới khi cần.",
    statusChat: "Trò chuyện",
    statusEnded: "Đã kết thúc"
  },
  id: {
    title: "Ketuk tombol di bawah dan bicara",
    placeholder: "Ketik apa yang ingin Anda sampaikan di sini.",
    submit: "Kirim terjemahan",
    chatStarted: "Konsultasi terjemahan AI telah dimulai.",
    empty: "Anda dapat berkonsultasi dengan suara, atau mengetik di bawah jika perlu.",
    statusChat: "Chat",
    statusEnded: "Selesai"
  },
  tl: {
    title: "I-tap ang button sa ibaba at magsalita",
    placeholder: "I-type dito ang gusto mong sabihin.",
    submit: "Ipadala ang salin",
    chatStarted: "Nagsimula na ang AI translation consultation.",
    empty: "Maaari kang kumonsulta gamit ang boses, o mag-type sa ibaba kung kailangan.",
    statusChat: "Chat",
    statusEnded: "Tapos na"
  },
  fr: {
    title: "Touchez le bouton ci-dessous et parlez",
    placeholder: "Écrivez ici ce que vous voulez dire.",
    submit: "Envoyer la traduction",
    chatStarted: "La consultation avec traduction IA a commencé.",
    empty: "Vous pouvez consulter par voix, ou écrire ci-dessous si nécessaire.",
    statusChat: "Chat",
    statusEnded: "Terminé"
  },
  es: {
    title: "Toque el botón de abajo y hable",
    placeholder: "Escriba aquí lo que quiere decir.",
    submit: "Enviar traducción",
    chatStarted: "La consulta con traducción de IA ha comenzado.",
    empty: "Puede consultar por voz o escribir abajo si es necesario.",
    statusChat: "Chat",
    statusEnded: "Finalizado"
  },
  de: {
    title: "Tippen Sie unten und sprechen Sie",
    placeholder: "Geben Sie hier ein, was Sie sagen möchten.",
    submit: "Übersetzung senden",
    chatStarted: "Die KI-Übersetzungsberatung hat begonnen.",
    empty: "Sie können per Sprache beraten werden oder bei Bedarf unten schreiben.",
    statusChat: "Chat",
    statusEnded: "Beendet"
  },
  it: {
    title: "Tocca il pulsante sotto e parla",
    placeholder: "Scrivi qui ciò che vuoi dire.",
    submit: "Invia traduzione",
    chatStarted: "La consulenza con traduzione AI è iniziata.",
    empty: "Puoi fare la consulenza con la voce o scrivere sotto se necessario.",
    statusChat: "Chat",
    statusEnded: "Terminato"
  },
  pt: {
    title: "Toque no botão abaixo e fale",
    placeholder: "Digite aqui o que você quer dizer.",
    submit: "Enviar tradução",
    chatStarted: "A consulta com tradução por IA começou.",
    empty: "Você pode consultar por voz ou digitar abaixo se necessário.",
    statusChat: "Chat",
    statusEnded: "Encerrado"
  }
};

export const consultationDeliveryStatusCopy: Partial<Record<PatientLanguage, DeliveryStatusCopy>> & { en: DeliveryStatusCopy; zh_tw: DeliveryStatusCopy } = {
  zh: { sending: "正在发送", failed: "发送失败", read: "已读" },
  yue: { sending: "正在傳送", failed: "傳送失敗", read: "已讀" },
  zh_tw: { sending: "正在傳送", failed: "傳送失敗", read: "已讀" },
  ja: { sending: "送信中", failed: "送信に失敗しました", read: "既読" },
  en: { sending: "Sending", failed: "Send failed", read: "Read" },
  th: { sending: "กำลังส่ง", failed: "ส่งไม่สำเร็จ", read: "อ่านแล้ว" },
  ms: { sending: "Menghantar", failed: "Gagal dihantar", read: "Dibaca" },
  mn: { sending: "Илгээж байна", failed: "Илгээж чадсангүй", read: "Уншсан" },
  ru: { sending: "Отправка", failed: "Не удалось отправить", read: "Прочитано" },
  vi: { sending: "Đang gửi", failed: "Gửi thất bại", read: "Đã đọc" },
  id: { sending: "Mengirim", failed: "Gagal mengirim", read: "Dibaca" },
  tl: { sending: "Ipinapadala", failed: "Hindi naipadala", read: "Nabasa" },
  fr: { sending: "Envoi", failed: "Échec de l'envoi", read: "Lu" },
  es: { sending: "Enviando", failed: "Error al enviar", read: "Leído" },
  de: { sending: "Wird gesendet", failed: "Senden fehlgeschlagen", read: "Gelesen" },
  it: { sending: "Invio", failed: "Invio non riuscito", read: "Letto" },
  pt: { sending: "Enviando", failed: "Falha ao enviar", read: "Lido" }
};

export const stageByExampleCategory: Record<ConsultationExampleCategory, ConsultationStage> = {
  visit: "intake",
  concern: "medical",
  procedure: "procedure",
  price: "price_schedule",
  safety: "medical"
};

export const initialPatientSuggestionSet: Partial<Record<PatientLanguage, PatientFollowUpSuggestionSet>> & { en: PatientFollowUpSuggestionSet; zh_tw: PatientFollowUpSuggestionSet } = {
  zh: {
    label: "AI 推荐咨询",
    suggestions: ["我没有预约。今天可以咨询吗？", "我想咨询适合我的治疗。", "我想看完整价目表。", "可以刷卡付款吗？"]
  },
  yue: {
    label: "AI 推薦諮詢",
    suggestions: ["我沒有預約。今日可以諮詢嗎？", "我想諮詢適合我的療程。", "我想睇完整價目表。", "可以刷卡付款嗎？"]
  },
  zh_tw: {
    label: "AI 推薦諮詢",
    suggestions: ["我沒有預約。今天可以諮詢嗎？", "我想諮詢適合我的療程。", "我想看完整價目表。", "可以刷卡付款嗎？"]
  },
  ja: {
    label: "AIおすすめ質問",
    suggestions: ["予約していません。今日カウンセリングできますか？", "自分に合う施術を相談したいです。", "全体の料金表を見たいです。", "カードで支払えますか？"]
  },
  en: {
    label: "AI suggested questions",
    suggestions: [
      "I don't have an appointment. Can I have a consultation today?",
      "I would like to ask which procedure is suitable for me.",
      "I would like to see the full price list.",
      "Can I pay by card?"
    ]
  },
  th: {
    label: "คำถามแนะนำโดย AI",
    suggestions: ["ฉันยังไม่ได้นัด วันนี้ปรึกษาได้ไหม?", "ฉันอยากถามว่าหัตถการแบบไหนเหมาะกับฉัน", "ฉันอยากดูรายการราคาทั้งหมด", "ชำระด้วยบัตรได้ไหม?"]
  },
  ms: {
    label: "Soalan cadangan AI",
    suggestions: ["Saya belum membuat janji temu. Boleh konsultasi hari ini?", "Saya ingin tahu rawatan apa yang sesuai untuk saya.", "Saya ingin melihat senarai harga penuh.", "Boleh bayar dengan kad?"]
  },
  mn: {
    label: "AI санал болгосон асуултууд",
    suggestions: ["Би цаг аваагүй. Өнөөдөр зөвлөгөө авч болох уу?", "Надад ямар ажилбар тохирохыг асуумаар байна.", "Бүрэн үнийн жагсаалтыг хармаар байна.", "Картаар төлж болох уу?"]
  },
  ru: {
    label: "AI рекомендует вопросы",
    suggestions: ["У меня нет записи. Можно пройти консультацию сегодня?", "Я хочу узнать, какая процедура мне подходит.", "Я хочу посмотреть полный прайс-лист.", "Можно оплатить картой?"]
  },
  vi: {
    label: "AI gợi ý câu hỏi",
    suggestions: ["Tôi chưa đặt lịch. Hôm nay tôi có thể tư vấn được không?", "Tôi muốn hỏi liệu trình nào phù hợp với mình.", "Tôi muốn xem bảng giá đầy đủ.", "Tôi có thể thanh toán bằng thẻ không?"]
  },
  id: {
    label: "Pertanyaan saran AI",
    suggestions: ["Saya belum membuat janji. Apakah saya bisa konsultasi hari ini?", "Saya ingin bertanya perawatan apa yang cocok untuk saya.", "Saya ingin melihat daftar harga lengkap.", "Apakah bisa bayar dengan kartu?"]
  },
  tl: {
    label: "Mga tanong na mungkahi ng AI",
    suggestions: ["Wala akong appointment. Maaari ba akong magpa-consult ngayon?", "Gusto kong malaman kung anong procedure ang bagay sa akin.", "Gusto kong makita ang buong price list.", "Maaari bang magbayad gamit ang card?"]
  },
  fr: {
    label: "Questions suggérées par l'IA",
    suggestions: ["Je n'ai pas de rendez-vous. Puis-je avoir une consultation aujourd'hui ?", "Je voudrais savoir quel traitement me convient.", "Je voudrais voir la liste complète des prix.", "Puis-je payer par carte ?"]
  },
  es: {
    label: "Preguntas sugeridas por IA",
    suggestions: ["No tengo cita. ¿Puedo tener una consulta hoy?", "Quisiera saber qué tratamiento es adecuado para mí.", "Quisiera ver la lista completa de precios.", "¿Puedo pagar con tarjeta?"]
  },
  de: {
    label: "KI-Fragevorschläge",
    suggestions: ["Ich habe keinen Termin. Kann ich heute eine Beratung bekommen?", "Ich möchte wissen, welche Behandlung für mich geeignet ist.", "Ich möchte die vollständige Preisliste sehen.", "Kann ich mit Karte bezahlen?"]
  },
  it: {
    label: "Domande suggerite dall'AI",
    suggestions: ["Non ho un appuntamento. Posso fare una consulenza oggi?", "Vorrei sapere quale trattamento è adatto a me.", "Vorrei vedere il listino prezzi completo.", "Posso pagare con carta?"]
  },
  pt: {
    label: "Perguntas sugeridas por IA",
    suggestions: ["Não tenho agendamento. Posso fazer uma consulta hoje?", "Gostaria de saber qual procedimento é adequado para mim.", "Gostaria de ver a lista completa de preços.", "Posso pagar com cartão?"]
  }
};

type ConsultationExampleCategoryCopy = Record<ConsultationExampleCategory, { label: string; examples: string[] }>;

export const consultationExampleCategories: Partial<Record<PatientLanguage, ConsultationExampleCategoryCopy>> & {
  en: ConsultationExampleCategoryCopy;
  zh_tw: ConsultationExampleCategoryCopy;
} = {
  zh: {
    visit: { label: "来院目的", examples: ["我没有预约。今天可以咨询吗？", "如果可以的话，我今天想做治疗。"] },
    concern: { label: "症状/烦恼", examples: ["我想咨询适合我的治疗。", "我有红肿、瘙痒或疼痛。"] },
    procedure: { label: "治疗咨询", examples: ["我想咨询皮肤营养注射。", "我想咨询提升治疗。"] },
    price: { label: "价格/预约", examples: ["我想看完整价目表。", "可以刷卡付款吗？"] },
    safety: { label: "安全确认", examples: ["我正在服药或有过敏史。", "我想知道恢复期，因为我有旅行计划。"] }
  },
  zh_tw: {
    visit: { label: "來院目的", examples: ["我沒有預約。今天可以諮詢嗎？", "如果可以的話，我今天也想做療程。"] },
    concern: { label: "症狀/困擾", examples: ["我想諮詢適合我的療程。", "我有泛紅、搔癢或疼痛。"] },
    procedure: { label: "療程諮詢", examples: ["我想諮詢皮膚營養針。", "我想諮詢拉提療程。"] },
    price: { label: "價格/預約", examples: ["我想看完整價目表。", "可以刷卡付款嗎？"] },
    safety: { label: "安全確認", examples: ["我正在服藥或有過敏史。", "因為有旅行計畫，我想知道恢復期。"] }
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
  th: {
    visit: { label: "การมาเยือน", examples: ["ฉันยังไม่ได้นัด วันนี้ปรึกษาได้ไหม?", "ถ้าเป็นไปได้ ฉันอยากทำหัตถการวันนี้ด้วย"] },
    concern: { label: "ความกังวล", examples: ["ฉันอยากถามว่าหัตถการแบบไหนเหมาะกับฉัน", "ฉันมีผื่นแดง คัน หรือปวด"] },
    procedure: { label: "หัตถการ", examples: ["ฉันอยากปรึกษาเรื่อง skin booster", "ฉันอยากปรึกษาเรื่องการยกกระชับ"] },
    price: { label: "ราคา", examples: ["ฉันอยากดูรายการราคาทั้งหมด", "ชำระด้วยบัตรได้ไหม?"] },
    safety: { label: "ความปลอดภัย", examples: ["ฉันกำลังทานยาอยู่หรือมีประวัติแพ้", "ฉันอยากทราบระยะพักฟื้นเพราะมีแผนเดินทาง"] }
  },
  ms: {
    visit: { label: "Lawatan", examples: ["Saya belum membuat janji temu. Boleh konsultasi hari ini?", "Jika boleh, saya juga ingin rawatan hari ini."] },
    concern: { label: "Kebimbangan", examples: ["Saya ingin tahu rawatan apa yang sesuai untuk saya.", "Saya mengalami kemerahan, gatal atau sakit."] },
    procedure: { label: "Rawatan", examples: ["Saya ingin bertanya tentang rawatan skin booster.", "Saya ingin bertanya tentang rawatan lifting."] },
    price: { label: "Harga", examples: ["Saya ingin melihat senarai harga penuh.", "Boleh bayar dengan kad?"] },
    safety: { label: "Keselamatan", examples: ["Saya sedang mengambil ubat atau mempunyai alahan.", "Saya perlu tahu tempoh pemulihan kerana jadual perjalanan saya."] }
  },
  mn: {
    visit: { label: "Ирсэн зорилго", examples: ["Би цаг аваагүй. Өнөөдөр зөвлөгөө авч болох уу?", "Боломжтой бол өнөөдөр ажилбар хийлгэмээр байна."] },
    concern: { label: "Асуудал", examples: ["Надад ямар ажилбар тохирохыг асуумаар байна.", "Улайх, загатнах эсвэл өвдөх шинж байна."] },
    procedure: { label: "Ажилбар", examples: ["Skin booster ажилбарын талаар зөвлөгөө авмаар байна.", "Лифтинг ажилбарын талаар зөвлөгөө авмаар байна."] },
    price: { label: "Үнэ", examples: ["Бүрэн үнийн жагсаалтыг хармаар байна.", "Картаар төлж болох уу?"] },
    safety: { label: "Аюулгүй байдал", examples: ["Би эм ууж байгаа эсвэл харшилтай.", "Аяллын төлөвлөгөөтэй тул эдгэрэх хугацааг мэдмээр байна."] }
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

export function inferConsultationStage(messageText: string | undefined, fallback: ConsultationStage = "intake") {
  const normalizedText = normalizeForMatch(messageText ?? "");
  if (!normalizedText) return fallback;

  const ranked = keywordSuggestionSets
    .map((set) => ({
      stages: set.stages ?? [],
      score: set.keywords.reduce((total, keyword) => total + (normalizedText.includes(normalizeForMatch(keyword)) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0 && item.stages.length)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.stages[0] ?? fallback;
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

function inferPatientSuggestionStage(staffMessageText: string | undefined) {
  const normalizedText = normalizeForMatch(staffMessageText ?? "");
  if (!normalizedText) return "intake" satisfies ConsultationStage;

  const stageKeywords: Record<ConsultationStage, string[]> = {
    intake: [
      "상담",
      "시술까지",
      "오늘",
      "처음",
      "방문",
      "预约",
      "今天",
      "第一次",
      "相談",
      "今日",
      "初めて",
      "consultation",
      "today",
      "firstvisit",
      "visite",
      "consulta",
      "beratung"
    ],
    medical: [
      "복용",
      "약",
      "알레르기",
      "임신",
      "수유",
      "질환",
      "过敏",
      "服药",
      "怀孕",
      "哺乳",
      "药",
      "薬",
      "アレルギー",
      "妊娠",
      "授乳",
      "medication",
      "medicine",
      "allergy",
      "pregnant",
      "breastfeeding",
      "médicament",
      "allergie",
      "medicamento",
      "alergia",
      "medikament",
      "allergie"
    ],
    procedure: [
      "시술",
      "효과",
      "부위",
      "리프팅",
      "스킨부스터",
      "보톡스",
      "필러",
      "施术",
      "治疗",
      "效果",
      "部位",
      "施術",
      "効果",
      "部位",
      "treatment",
      "procedure",
      "effect",
      "lifting",
      "booster",
      "traitement",
      "procedimiento",
      "behandlung"
    ],
    price_schedule: [
      "가격",
      "비용",
      "결제",
      "카드",
      "예약",
      "날짜",
      "시간",
      "费用",
      "价格",
      "刷卡",
      "预约",
      "料金",
      "費用",
      "カード",
      "予約",
      "price",
      "cost",
      "card",
      "book",
      "appointment",
      "prix",
      "carte",
      "réserver",
      "precio",
      "tarjeta",
      "reservar",
      "preis",
      "karte",
      "termin"
    ],
    summary: [
      "요약",
      "마무리",
      "주의사항",
      "궁금",
      "总结",
      "注意事项",
      "まとめ",
      "注意事項",
      "summary",
      "summarize",
      "precautions",
      "résumer",
      "précautions",
      "resumen",
      "precauciones",
      "zusammenfassen",
      "vorsichts"
    ]
  };

  const ranked = consultationStages
    .map((stage) => ({
      stage: stage.id,
      score: stageKeywords[stage.id].reduce((total, keyword) => total + (normalizedText.includes(normalizeForMatch(keyword)) ? 1 : 0), 0)
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score ? ranked[0].stage : ("intake" satisfies ConsultationStage);
}

export function getPatientFollowUpSuggestionSet(staffMessageText: string | undefined, patientLanguage: PatientLanguage) {
  const normalizedText = normalizeForMatch(staffMessageText ?? "");
  const fallbackInitialSuggestionSet =
    initialPatientSuggestionSet[patientLanguage] ??
    (patientLanguage === "yue" ? initialPatientSuggestionSet.zh_tw : initialPatientSuggestionSet.en);
  if (!normalizedText) return fallbackInitialSuggestionSet;

  const suggestions: Partial<Record<PatientLanguage, Record<ConsultationStage, PatientFollowUpSuggestionSet>>> & {
    en: Record<ConsultationStage, PatientFollowUpSuggestionSet>;
    zh_tw: Record<ConsultationStage, PatientFollowUpSuggestionSet>;
  } = {
    zh: {
      intake: { label: "下一步可以这样回答", suggestions: ["我今天只想先咨询。", "如果可以，我今天也想做治疗。", "我想预约其他日期。", "这是我第一次来这家医院。"] },
      medical: { label: "安全信息确认", suggestions: ["我有正在服用的药。", "我没有药物过敏。", "我有过敏史。", "我想知道是否可以治疗。"] },
      procedure: { label: "治疗咨询问题", suggestions: ["我想知道哪种治疗适合我。", "我担心疼痛。", "我想知道恢复期。", "我想要自然的效果。"] },
      price_schedule: { label: "价格和预约问题", suggestions: ["请告诉我大概费用。", "可以刷卡付款吗？", "今天可以预约吗？", "治疗后我需要再次来院吗？"] },
      summary: { label: "结束前确认", suggestions: ["请再简单总结一下。", "我想现在预约。", "我想再考虑一下。", "请告诉我注意事项。"] }
    },
    zh_tw: {
      intake: { label: "下一步可以這樣回答", suggestions: ["我今天只想先諮詢。", "如果可以，我今天也想做療程。", "我想預約其他日期。", "這是我第一次來這家醫院。"] },
      medical: { label: "安全資訊確認", suggestions: ["我有正在服用的藥。", "我沒有藥物過敏。", "我有過敏史。", "我想確認是否可以做療程。"] },
      procedure: { label: "療程諮詢問題", suggestions: ["我想知道哪種療程適合我。", "我擔心疼痛。", "我想知道恢復期。", "我想要自然的效果。"] },
      price_schedule: { label: "價格和預約問題", suggestions: ["請告訴我大概費用。", "可以刷卡付款嗎？", "今天可以預約嗎？", "療程後我需要再次來院嗎？"] },
      summary: { label: "結束前確認", suggestions: ["請再簡單總結一下。", "我想現在預約。", "我想再考慮一下。", "請告訴我注意事項。"] }
    },
    ja: {
      intake: { label: "次にこう答えられます", suggestions: ["今日はまず相談だけしたいです。", "可能であれば今日施術も受けたいです。", "別の日に予約したいです。", "この病院は初めてです。"] },
      medical: { label: "安全情報の確認", suggestions: ["服用中の薬があります。", "薬のアレルギーはありません。", "アレルギーがあります。", "施術を受けられるか確認したいです。"] },
      procedure: { label: "施術についての質問", suggestions: ["自分に合う施術を知りたいです。", "痛みが心配です。", "回復期間を知りたいです。", "自然な効果を希望します。"] },
      price_schedule: { label: "料金と予約の質問", suggestions: ["おおよその費用を教えてください。", "カードで支払えますか？", "今日予約できますか？", "施術後に再来院が必要ですか？"] },
      summary: { label: "最後の確認", suggestions: ["もう一度簡単にまとめてください。", "今予約したいです。", "少し考えたいです。", "注意事項を教えてください。"] }
    },
    en: {
      intake: { label: "You can answer next", suggestions: ["I would like consultation only today.", "If possible, I would like treatment today too.", "I would like to book another date.", "This is my first visit to this clinic."] },
      medical: { label: "Safety details to share", suggestions: ["I am taking medication.", "I do not have medication allergies.", "I have allergies.", "I want to check if treatment is safe for me."] },
      procedure: { label: "Treatment questions", suggestions: ["I want to know which treatment suits me.", "I am worried about pain.", "I want to know the recovery time.", "I want a natural-looking result."] },
      price_schedule: { label: "Price and booking questions", suggestions: ["Please tell me the approximate cost.", "Can I pay by card?", "Can I book today?", "Do I need to visit again after treatment?"] },
      summary: { label: "Before finishing", suggestions: ["Please summarize it again simply.", "I would like to book now.", "I would like to think about it.", "Please tell me the precautions."] }
    },
    th: {
      intake: { label: "คุณสามารถตอบได้", suggestions: ["วันนี้ฉันอยากปรึกษาก่อนเท่านั้น", "ถ้าเป็นไปได้ ฉันอยากทำหัตถการวันนี้ด้วย", "ฉันอยากจองวันอื่น", "นี่เป็นครั้งแรกที่มาคลินิกนี้"] },
      medical: { label: "ข้อมูลความปลอดภัย", suggestions: ["ฉันกำลังทานยาอยู่", "ฉันไม่มีอาการแพ้ยา", "ฉันมีประวัติแพ้", "ฉันอยากตรวจสอบว่าหัตถการนี้ปลอดภัยสำหรับฉันไหม"] },
      procedure: { label: "คำถามเกี่ยวกับหัตถการ", suggestions: ["ฉันอยากรู้ว่าหัตถการแบบไหนเหมาะกับฉัน", "ฉันกังวลเรื่องความเจ็บ", "ฉันอยากรู้ระยะพักฟื้น", "ฉันต้องการผลลัพธ์ที่เป็นธรรมชาติ"] },
      price_schedule: { label: "ราคาและการจอง", suggestions: ["กรุณาบอกค่าใช้จ่ายโดยประมาณ", "ชำระด้วยบัตรได้ไหม?", "วันนี้จองได้ไหม?", "หลังทำต้องกลับมาที่คลินิกอีกไหม?"] },
      summary: { label: "ก่อนจบ", suggestions: ["กรุณาสรุปให้อีกครั้งแบบง่ายๆ", "ฉันอยากจองตอนนี้", "ฉันอยากคิดดูก่อน", "กรุณาบอกข้อควรระวัง"] }
    },
    ms: {
      intake: { label: "Anda boleh menjawab", suggestions: ["Hari ini saya hanya mahu konsultasi dahulu.", "Jika boleh, saya juga mahu rawatan hari ini.", "Saya ingin menempah tarikh lain.", "Ini lawatan pertama saya ke klinik ini."] },
      medical: { label: "Maklumat keselamatan", suggestions: ["Saya sedang mengambil ubat.", "Saya tiada alahan ubat.", "Saya mempunyai alahan.", "Saya ingin pastikan sama ada rawatan ini selamat untuk saya."] },
      procedure: { label: "Soalan rawatan", suggestions: ["Saya ingin tahu rawatan apa yang sesuai untuk saya.", "Saya risau tentang kesakitan.", "Saya ingin tahu tempoh pemulihan.", "Saya mahukan hasil yang natural."] },
      price_schedule: { label: "Harga dan tempahan", suggestions: ["Sila beritahu anggaran kos.", "Boleh bayar dengan kad?", "Boleh buat tempahan hari ini?", "Adakah saya perlu datang semula selepas rawatan?"] },
      summary: { label: "Sebelum tamat", suggestions: ["Sila ringkaskan sekali lagi dengan mudah.", "Saya ingin menempah sekarang.", "Saya ingin fikir dahulu.", "Sila beritahu perkara yang perlu diberi perhatian."] }
    },
    mn: {
      intake: { label: "Та ингэж хариулж болно", suggestions: ["Өнөөдөр зөвхөн зөвлөгөө авмаар байна.", "Боломжтой бол өнөөдөр ажилбар хийлгэмээр байна.", "Өөр өдөр цаг авмаар байна.", "Энэ эмнэлэгт анх удаа ирж байна."] },
      medical: { label: "Аюулгүй байдлын мэдээлэл", suggestions: ["Би эм ууж байгаа.", "Би эмийн харшилгүй.", "Би харшилтай.", "Энэ ажилбар надад аюулгүй эсэхийг шалгамаар байна."] },
      procedure: { label: "Ажилбарын асуулт", suggestions: ["Надад ямар ажилбар тохирохыг мэдмээр байна.", "Өвдөлтөөс санаа зовж байна.", "Эдгэрэх хугацааг мэдмээр байна.", "Байгалийн үр дүн хүсэж байна."] },
      price_schedule: { label: "Үнэ ба цаг авах", suggestions: ["Ойролцоогоор зардлыг хэлж өгнө үү.", "Картаар төлж болох уу?", "Өнөөдөр цаг авч болох уу?", "Ажилбарын дараа дахин ирэх шаардлагатай юу?"] },
      summary: { label: "Дуусахаас өмнө", suggestions: ["Дахин энгийнээр товчлоод хэлнэ үү.", "Одоо цаг авмаар байна.", "Би жаахан бодмоор байна.", "Анхаарах зүйлсийг хэлж өгнө үү."] }
    },
    ru: {
      intake: { label: "Можно ответить так", suggestions: ["Сегодня я хочу только консультацию.", "Если возможно, я хочу процедуру сегодня.", "Я хочу записаться на другую дату.", "Я впервые в этой клинике."] },
      medical: { label: "Данные для безопасности", suggestions: ["Я принимаю лекарства.", "У меня нет аллергии на лекарства.", "У меня есть аллергия.", "Я хочу проверить, безопасна ли процедура для меня."] },
      procedure: { label: "Вопросы о процедуре", suggestions: ["Я хочу узнать, какая процедура мне подходит.", "Я беспокоюсь о боли.", "Я хочу узнать срок восстановления.", "Я хочу естественный результат."] },
      price_schedule: { label: "Цена и запись", suggestions: ["Скажите примерную стоимость.", "Можно оплатить картой?", "Можно записаться сегодня?", "Нужно ли прийти снова после процедуры?"] },
      summary: { label: "Перед завершением", suggestions: ["Пожалуйста, кратко подытожьте еще раз.", "Я хочу записаться сейчас.", "Я хочу подумать.", "Расскажите, пожалуйста, о мерах предосторожности."] }
    },
    vi: {
      intake: { label: "Bạn có thể trả lời", suggestions: ["Hôm nay tôi chỉ muốn tư vấn trước.", "Nếu được, tôi cũng muốn làm liệu trình hôm nay.", "Tôi muốn đặt lịch vào ngày khác.", "Đây là lần đầu tôi đến phòng khám này."] },
      medical: { label: "Thông tin an toàn", suggestions: ["Tôi đang dùng thuốc.", "Tôi không dị ứng thuốc.", "Tôi có dị ứng.", "Tôi muốn kiểm tra liệu trình có an toàn cho tôi không."] },
      procedure: { label: "Câu hỏi về liệu trình", suggestions: ["Tôi muốn biết liệu trình nào phù hợp với tôi.", "Tôi lo về đau.", "Tôi muốn biết thời gian hồi phục.", "Tôi muốn kết quả tự nhiên."] },
      price_schedule: { label: "Giá và đặt lịch", suggestions: ["Vui lòng cho tôi biết chi phí ước tính.", "Tôi có thể thanh toán bằng thẻ không?", "Hôm nay tôi có thể đặt lịch không?", "Sau liệu trình tôi có cần quay lại không?"] },
      summary: { label: "Trước khi kết thúc", suggestions: ["Vui lòng tóm tắt lại đơn giản.", "Tôi muốn đặt lịch ngay.", "Tôi muốn suy nghĩ thêm.", "Vui lòng cho tôi biết những điều cần lưu ý."] }
    },
    id: {
      intake: { label: "Anda bisa menjawab", suggestions: ["Hari ini saya ingin konsultasi saja dulu.", "Jika memungkinkan, saya juga ingin perawatan hari ini.", "Saya ingin membuat janji di tanggal lain.", "Ini kunjungan pertama saya ke klinik ini."] },
      medical: { label: "Informasi keamanan", suggestions: ["Saya sedang minum obat.", "Saya tidak memiliki alergi obat.", "Saya memiliki alergi.", "Saya ingin memastikan apakah perawatan ini aman untuk saya."] },
      procedure: { label: "Pertanyaan perawatan", suggestions: ["Saya ingin tahu perawatan apa yang cocok untuk saya.", "Saya khawatir tentang rasa sakit.", "Saya ingin tahu masa pemulihan.", "Saya ingin hasil yang natural."] },
      price_schedule: { label: "Harga dan jadwal", suggestions: ["Tolong beri tahu perkiraan biayanya.", "Apakah bisa bayar dengan kartu?", "Apakah saya bisa membuat janji hari ini?", "Apakah saya perlu datang lagi setelah perawatan?"] },
      summary: { label: "Sebelum selesai", suggestions: ["Tolong rangkum lagi dengan sederhana.", "Saya ingin membuat janji sekarang.", "Saya ingin memikirkannya dulu.", "Tolong beri tahu hal-hal yang perlu diperhatikan."] }
    },
    fr: {
      intake: { label: "Vous pouvez répondre", suggestions: ["Je voudrais seulement une consultation aujourd'hui.", "Si possible, je voudrais aussi faire un traitement aujourd'hui.", "Je voudrais réserver une autre date.", "C'est ma première visite dans cette clinique."] },
      medical: { label: "Informations de sécurité", suggestions: ["Je prends des médicaments.", "Je n'ai pas d'allergie médicamenteuse.", "J'ai des allergies.", "Je veux vérifier si le traitement est sûr pour moi."] },
      procedure: { label: "Questions sur le traitement", suggestions: ["Je veux savoir quel traitement me convient.", "J'ai peur de la douleur.", "Je veux connaître le temps de récupération.", "Je veux un résultat naturel."] },
      price_schedule: { label: "Prix et réservation", suggestions: ["Veuillez m'indiquer le coût approximatif.", "Puis-je payer par carte ?", "Puis-je réserver aujourd'hui ?", "Dois-je revenir après le traitement ?"] },
      summary: { label: "Avant de terminer", suggestions: ["Veuillez résumer simplement encore une fois.", "Je voudrais réserver maintenant.", "Je voudrais y réfléchir.", "Veuillez m'indiquer les précautions."] }
    },
    es: {
      intake: { label: "Puede responder", suggestions: ["Hoy solo quiero una consulta primero.", "Si es posible, también quisiera tratamiento hoy.", "Quisiera reservar otra fecha.", "Es mi primera visita a esta clínica."] },
      medical: { label: "Información de seguridad", suggestions: ["Estoy tomando medicamentos.", "No tengo alergias a medicamentos.", "Tengo alergias.", "Quiero confirmar si el tratamiento es seguro para mí."] },
      procedure: { label: "Preguntas sobre tratamiento", suggestions: ["Quiero saber qué tratamiento me conviene.", "Me preocupa el dolor.", "Quiero saber el tiempo de recuperación.", "Quiero un resultado natural."] },
      price_schedule: { label: "Precio y reserva", suggestions: ["Por favor dígame el costo aproximado.", "¿Puedo pagar con tarjeta?", "¿Puedo reservar hoy?", "¿Necesito volver después del tratamiento?"] },
      summary: { label: "Antes de terminar", suggestions: ["Por favor resúmalo de forma simple otra vez.", "Quisiera reservar ahora.", "Quisiera pensarlo.", "Por favor dígame las precauciones."] }
    },
    de: {
      intake: { label: "Sie können antworten", suggestions: ["Ich möchte heute zuerst nur eine Beratung.", "Wenn möglich, möchte ich heute auch eine Behandlung.", "Ich möchte einen anderen Termin buchen.", "Dies ist mein erster Besuch in dieser Klinik."] },
      medical: { label: "Sicherheitsinformationen", suggestions: ["Ich nehme Medikamente.", "Ich habe keine Medikamentenallergie.", "Ich habe Allergien.", "Ich möchte prüfen, ob die Behandlung für mich sicher ist."] },
      procedure: { label: "Fragen zur Behandlung", suggestions: ["Ich möchte wissen, welche Behandlung zu mir passt.", "Ich mache mir Sorgen wegen Schmerzen.", "Ich möchte die Erholungszeit wissen.", "Ich möchte ein natürliches Ergebnis."] },
      price_schedule: { label: "Preis und Termin", suggestions: ["Bitte nennen Sie mir die ungefähren Kosten.", "Kann ich mit Karte bezahlen?", "Kann ich heute einen Termin buchen?", "Muss ich nach der Behandlung wiederkommen?"] },
      summary: { label: "Vor dem Abschluss", suggestions: ["Bitte fassen Sie es noch einmal einfach zusammen.", "Ich möchte jetzt buchen.", "Ich möchte darüber nachdenken.", "Bitte nennen Sie mir die Vorsichtsmaßnahmen."] }
    },
    it: {
      intake: { label: "Puoi rispondere", suggestions: ["Oggi vorrei solo una consulenza.", "Se possibile, vorrei fare anche il trattamento oggi.", "Vorrei prenotare un'altra data.", "È la mia prima visita in questa clinica."] },
      medical: { label: "Informazioni di sicurezza", suggestions: ["Sto assumendo farmaci.", "Non ho allergie ai farmaci.", "Ho allergie.", "Vorrei verificare se il trattamento è sicuro per me."] },
      procedure: { label: "Domande sul trattamento", suggestions: ["Vorrei sapere quale trattamento è adatto a me.", "Sono preoccupato/a per il dolore.", "Vorrei sapere i tempi di recupero.", "Vorrei un risultato naturale."] },
      price_schedule: { label: "Prezzo e prenotazione", suggestions: ["Mi dica il costo approssimativo.", "Posso pagare con carta?", "Posso prenotare oggi?", "Devo tornare dopo il trattamento?"] },
      summary: { label: "Prima di finire", suggestions: ["Può riassumere di nuovo in modo semplice?", "Vorrei prenotare ora.", "Vorrei pensarci.", "Mi dica le precauzioni da seguire."] }
    },
    pt: {
      intake: { label: "Você pode responder", suggestions: ["Hoje eu gostaria apenas de uma consulta primeiro.", "Se possível, também gostaria de fazer o procedimento hoje.", "Gostaria de agendar outra data.", "Esta é minha primeira visita a esta clínica."] },
      medical: { label: "Informações de segurança", suggestions: ["Estou tomando medicamentos.", "Não tenho alergia a medicamentos.", "Tenho alergias.", "Quero confirmar se o procedimento é seguro para mim."] },
      procedure: { label: "Perguntas sobre procedimento", suggestions: ["Quero saber qual procedimento é adequado para mim.", "Estou preocupado(a) com a dor.", "Quero saber o tempo de recuperação.", "Quero um resultado natural."] },
      price_schedule: { label: "Preço e agendamento", suggestions: ["Por favor, informe o custo aproximado.", "Posso pagar com cartão?", "Posso agendar hoje?", "Preciso voltar depois do procedimento?"] },
      summary: { label: "Antes de terminar", suggestions: ["Por favor, resuma de forma simples novamente.", "Gostaria de agendar agora.", "Gostaria de pensar um pouco.", "Por favor, informe os cuidados necessários."] }
    }
  };

  const languageSuggestions = suggestions[patientLanguage] ?? (patientLanguage === "yue" ? suggestions.zh_tw : suggestions.en);
  return languageSuggestions[inferPatientSuggestionStage(staffMessageText)] ?? fallbackInitialSuggestionSet;
}
