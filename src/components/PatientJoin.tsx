"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { languageLabels, patientLanguageTags, type PatientLanguage } from "@/lib/languages";
import type { RoomStatus } from "@/lib/room-state";
import { broadcastRoomUpdate } from "@/lib/supabase-realtime";
import { VoiceRoom } from "@/components/VoiceRoom";
import { PatientTextSizeControl, patientTextSizeClassName, usePatientTextSize } from "@/components/PatientTextSizeControl";

const copy: Record<
  PatientLanguage,
  { title: string; body: string; procedureBody: string; consent: string; button: string; denied: string; joinDenied: string; languageLabel: string }
> = {
  zh: {
    title: "医院翻译室",
    body: "进入后可用语音咨询，文字输入可作为备用。不需要安装应用或注册账号。",
    procedureBody: "治疗过程中，翻译内容只会以文字显示在此手机上。请保持屏幕开启并查看文字。",
    consent: "为提供口译服务，您的语音可能会由外部 AI 服务处理。本服务不会保存原始语音或完整对话记录。",
    button: "进入房间",
    denied: "无法使用麦克风。请在浏览器设置中允许麦克风权限。",
    joinDenied: "无法进入房间。请让工作人员重新创建二维码。",
    languageLabel: "中文翻译"
  },
  yue: {
    title: "醫院翻譯室",
    body: "入室後可以用語音諮詢，文字輸入可以作為備用。不需要安裝 App 或註冊帳號。",
    procedureBody: "療程中，翻譯內容只會以文字顯示在此手機上。請保持螢幕開啟並查看文字。",
    consent: "為提供口譯服務，您的語音可能會由外部 AI 服務處理。本服務不會保存原始語音或完整對話紀錄。",
    button: "進入房間",
    denied: "無法使用麥克風。請在瀏覽器設定中允許麥克風權限。",
    joinDenied: "無法進入房間。請讓工作人員重新建立 QR Code。",
    languageLabel: "廣東話翻譯"
  },
  zh_tw: {
    title: "醫院翻譯室",
    body: "入室後可用語音諮詢，文字輸入可作為備用。不需要安裝 App 或註冊帳號。",
    procedureBody: "療程中，翻譯內容只會以文字顯示在此手機上。請保持螢幕開啟並查看文字。",
    consent: "為提供口譯服務，您的語音可能會由外部 AI 服務處理。本服務不會保存原始語音或完整對話紀錄。",
    button: "進入房間",
    denied: "無法使用麥克風。請在瀏覽器設定中允許麥克風權限。",
    joinDenied: "無法進入房間。請讓工作人員重新建立 QR Code。",
    languageLabel: "繁體中文翻譯"
  },
  ja: {
    title: "病院通訳ルーム",
    body: "入室後は音声で相談できます。文字入力は予備として使えます。アプリのインストールやアカウント登録は不要です。",
    procedureBody: "施術中の翻訳はこの端末では文字のみ表示されます。画面をオンにしたまま文字をご確認ください。",
    consent: "通訳のため、音声が外部AIサービスで処理される場合があります。元の音声や会話全文は保存しません。",
    button: "入室する",
    denied: "マイクを使用できません。ブラウザ設定でマイクの使用を許可してください。",
    joinDenied: "入室できません。スタッフにQRコードの再作成を依頼してください。",
    languageLabel: "日本語通訳"
  },
  en: {
    title: "Hospital Interpretation Room",
    body: "After entering, you can consult by voice. Typing is available as a backup. No app installation or account is required.",
    procedureBody: "During the procedure, translations will be shown as text only on this phone. Please keep the screen on and read the text.",
    consent: "To provide interpretation, your voice may be processed by an external AI service. We do not store raw audio or full conversation transcripts.",
    button: "Enter room",
    denied: "Microphone is unavailable. Please allow microphone access in your browser settings.",
    joinDenied: "Could not enter the room. Please ask the staff to create a new QR code.",
    languageLabel: "English interpretation"
  },
  th: {
    title: "ห้องล่ามของโรงพยาบาล",
    body: "หลังเข้าห้อง คุณสามารถปรึกษาด้วยเสียงได้ และใช้การพิมพ์เป็นตัวเลือกสำรอง ไม่ต้องติดตั้งแอปหรือสมัครบัญชี",
    procedureBody: "ระหว่างทำหัตถการ คำแปลจะแสดงเป็นข้อความเท่านั้นบนโทรศัพท์เครื่องนี้ กรุณาเปิดหน้าจอไว้และอ่านข้อความ",
    consent: "เพื่อให้บริการล่าม เสียงของคุณอาจถูกประมวลผลโดยบริการ AI ภายนอก เราจะไม่บันทึกเสียงต้นฉบับหรือบทสนทนาทั้งหมด",
    button: "เข้าห้อง",
    denied: "ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาตไมโครโฟนในการตั้งค่าเบราว์เซอร์",
    joinDenied: "ไม่สามารถเข้าห้องได้ กรุณาขอให้เจ้าหน้าที่สร้าง QR Code ใหม่",
    languageLabel: "ล่ามภาษาไทย"
  },
  ms: {
    title: "Bilik Interpretasi Klinik",
    body: "Selepas masuk, anda boleh berkonsultasi melalui suara. Menaip tersedia sebagai sandaran. Tidak perlu memasang aplikasi atau membuat akaun.",
    procedureBody: "Semasa prosedur, terjemahan akan dipaparkan sebagai teks sahaja pada telefon ini. Pastikan skrin kekal hidup dan baca teks.",
    consent: "Untuk menyediakan interpretasi, suara anda mungkin diproses oleh perkhidmatan AI luaran. Kami tidak menyimpan audio mentah atau transkrip perbualan penuh.",
    button: "Masuk",
    denied: "Mikrofon tidak tersedia. Sila benarkan akses mikrofon dalam tetapan pelayar.",
    joinDenied: "Tidak dapat masuk ke bilik. Sila minta staf mencipta kod QR baharu.",
    languageLabel: "Interpretasi Bahasa Melayu"
  },
  tl: {
    title: "Silid ng Interpretasyon sa Ospital",
    body: "Pagkatapos pumasok, maaari kang kumonsulta gamit ang boses. Maaari ring mag-type bilang backup. Hindi kailangang mag-install ng app o gumawa ng account.",
    procedureBody: "Habang ginagawa ang procedure, text lang ang ipapakita sa teleponong ito. Panatilihing bukas ang screen at basahin ang text.",
    consent: "Upang makapagbigay ng interpretasyon, maaaring iproseso ng external AI service ang iyong boses. Hindi namin sine-save ang raw audio o buong transcript ng usapan.",
    button: "Pumasok sa room",
    denied: "Hindi magamit ang mikropono. Payagan ang microphone access sa browser settings.",
    joinDenied: "Hindi makapasok sa room. Pakiusap sa staff na gumawa ng bagong QR code.",
    languageLabel: "Filipino interpretation"
  },
  mn: {
    title: "Эмнэлгийн орчуулгын өрөө",
    body: "Өрөөнд орсны дараа дуугаар зөвлөгөө авч болно. Бичих талбар нөөцөөр байна. Апп суулгах эсвэл бүртгэл үүсгэх шаардлагагүй.",
    procedureBody: "Ажилбарын үед орчуулга энэ утсан дээр зөвхөн бичвэрээр харагдана. Дэлгэцээ асаалттай байлгаж бичвэрийг уншина уу.",
    consent: "Орчуулга хийхийн тулд таны дуу хоолой гадаад AI үйлчилгээээр боловсруулагдаж болно. Бид эх аудио эсвэл бүтэн ярианы бичвэрийг хадгалахгүй.",
    button: "Өрөөнд орох",
    denied: "Микрофон ашиглах боломжгүй байна. Хөтчийн тохиргооноос микрофоны зөвшөөрлийг нээнэ үү.",
    joinDenied: "Өрөөнд орох боломжгүй байна. Ажилтнаас шинэ QR код үүсгэхийг хүснэ үү.",
    languageLabel: "Монгол орчуулга"
  },
  ru: {
    title: "Кабинет перевода в клинике",
    body: "После входа можно консультироваться голосом. Текст доступен как запасной вариант. Установка приложения и регистрация не требуются.",
    procedureBody: "Во время процедуры перевод будет отображаться на этом телефоне только текстом. Держите экран включенным и читайте текст.",
    consent: "Для перевода ваш голос может обрабатываться внешним AI-сервисом. Мы не сохраняем исходную аудиозапись или полный текст разговора.",
    button: "Войти",
    denied: "Микрофон недоступен. Разрешите доступ к микрофону в настройках браузера.",
    joinDenied: "Не удалось войти в комнату. Попросите сотрудника создать новый QR-код.",
    languageLabel: "Перевод на русский"
  },
  vi: {
    title: "Phòng phiên dịch bệnh viện",
    body: "Sau khi vào phòng, bạn có thể tư vấn bằng giọng nói. Nhập chữ là phương án dự phòng. Không cần cài ứng dụng hoặc tạo tài khoản.",
    procedureBody: "Trong quá trình thực hiện thủ thuật, bản dịch chỉ hiển thị bằng chữ trên điện thoại này. Vui lòng để màn hình bật và đọc nội dung.",
    consent: "Để cung cấp phiên dịch, giọng nói của bạn có thể được xử lý bởi dịch vụ AI bên ngoài. Chúng tôi không lưu âm thanh gốc hoặc toàn bộ nội dung cuộc trò chuyện.",
    button: "Vào phòng",
    denied: "Không thể sử dụng micro. Vui lòng cho phép quyền micro trong cài đặt trình duyệt.",
    joinDenied: "Không thể vào phòng. Vui lòng nhờ nhân viên tạo lại mã QR.",
    languageLabel: "Phiên dịch tiếng Việt"
  },
  id: {
    title: "Ruang Interpretasi Klinik",
    body: "Setelah masuk, Anda dapat berkonsultasi dengan suara. Mengetik tersedia sebagai cadangan. Tidak perlu memasang aplikasi atau membuat akun.",
    procedureBody: "Selama prosedur, terjemahan hanya akan ditampilkan sebagai teks di ponsel ini. Tetap nyalakan layar dan baca teksnya.",
    consent: "Untuk menyediakan interpretasi, suara Anda dapat diproses oleh layanan AI eksternal. Kami tidak menyimpan audio mentah atau transkrip percakapan lengkap.",
    button: "Masuk",
    denied: "Mikrofon tidak tersedia. Izinkan akses mikrofon di pengaturan browser.",
    joinDenied: "Tidak dapat masuk ke ruang. Minta staf membuat kode QR baru.",
    languageLabel: "Interpretasi Bahasa Indonesia"
  },
  fr: {
    title: "Salle d'interprétation de la clinique",
    body: "Après l'entrée, vous pouvez consulter par voix. Le texte reste disponible en secours. Aucune installation d'application ni création de compte n'est nécessaire.",
    procedureBody: "Pendant l'intervention, les traductions s'afficheront uniquement en texte sur ce téléphone. Gardez l'écran allumé et lisez le texte.",
    consent: "Pour fournir l'interprétation, votre voix peut être traitée par un service d'IA externe. Nous ne conservons pas l'audio brut ni la transcription complète de la conversation.",
    button: "Entrer",
    denied: "Le microphone n'est pas disponible. Veuillez autoriser l'accès au microphone dans les paramètres du navigateur.",
    joinDenied: "Impossible d'entrer dans la salle. Demandez au personnel de créer un nouveau QR code.",
    languageLabel: "Interprétation en français"
  },
  es: {
    title: "Sala de interpretación de la clínica",
    body: "Después de entrar, puede consultar por voz. El texto queda como respaldo. No necesita instalar una aplicación ni crear una cuenta.",
    procedureBody: "Durante el procedimiento, las traducciones se mostrarán solo como texto en este teléfono. Mantenga la pantalla encendida y lea el texto.",
    consent: "Para ofrecer la interpretación, su voz puede ser procesada por un servicio externo de IA. No guardamos el audio original ni la transcripción completa de la conversación.",
    button: "Entrar",
    denied: "El micrófono no está disponible. Permita el acceso al micrófono en la configuración del navegador.",
    joinDenied: "No se pudo entrar en la sala. Pida al personal que cree un nuevo código QR.",
    languageLabel: "Interpretación en español"
  },
  de: {
    title: "Dolmetschraum der Klinik",
    body: "Nach dem Betreten können Sie per Sprache beraten werden. Text bleibt als Reserve verfügbar. Eine App-Installation oder Kontoerstellung ist nicht erforderlich.",
    procedureBody: "Während der Behandlung werden Übersetzungen auf diesem Telefon nur als Text angezeigt. Lassen Sie den Bildschirm eingeschaltet und lesen Sie den Text.",
    consent: "Für die Verdolmetschung kann Ihre Stimme von einem externen KI-Dienst verarbeitet werden. Wir speichern weder Roh-Audio noch vollständige Gesprächsprotokolle.",
    button: "Raum betreten",
    denied: "Das Mikrofon ist nicht verfügbar. Bitte erlauben Sie den Mikrofonzugriff in den Browsereinstellungen.",
    joinDenied: "Der Raum konnte nicht betreten werden. Bitten Sie das Personal, einen neuen QR-Code zu erstellen.",
    languageLabel: "Deutsch-Dolmetschen"
  },
  it: {
    title: "Sala di interpretariato della clinica",
    body: "Dopo l'ingresso puoi fare la consulenza con la voce. Il testo resta come opzione di riserva. Non è necessario installare un'app o creare un account.",
    procedureBody: "Durante la procedura, le traduzioni saranno mostrate solo come testo su questo telefono. Tieni lo schermo acceso e leggi il testo.",
    consent: "Per fornire l'interpretariato, la tua voce può essere elaborata da un servizio IA esterno. Non conserviamo l'audio originale né la trascrizione completa della conversazione.",
    button: "Entra",
    denied: "Il microfono non è disponibile. Consenti l'accesso al microfono nelle impostazioni del browser.",
    joinDenied: "Impossibile entrare nella stanza. Chiedi allo staff di creare un nuovo codice QR.",
    languageLabel: "Interpretariato in italiano"
  },
  pt: {
    title: "Sala de interpretação da clínica",
    body: "Depois de entrar, você pode consultar por voz. O texto fica como opção de apoio. Não é necessário instalar aplicativo nem criar conta.",
    procedureBody: "Durante o procedimento, as traduções serão exibidas apenas como texto neste telefone. Mantenha a tela ligada e leia o texto.",
    consent: "Para fornecer a interpretação, sua voz pode ser processada por um serviço externo de IA. Não armazenamos o áudio bruto nem a transcrição completa da conversa.",
    button: "Entrar",
    denied: "O microfone não está disponível. Permita o acesso ao microfone nas configurações do navegador.",
    joinDenied: "Não foi possível entrar na sala. Peça à equipe para criar um novo QR code.",
    languageLabel: "Interpretação em português"
  }
};


const patientPrivacyCopy: Record<PatientLanguage, { detailsLabel: string; retention: string }> = {
  zh: { detailsLabel: "隐私与使用说明", retention: "每次翻译的原文和译文可能会在限定期限内保存，用于质量与安全检查。" },
  yue: { detailsLabel: "私隱及使用說明", retention: "每次翻譯嘅原文同譯文可能會喺限定期間內保存，用作質素及安全檢查。" },
  zh_tw: { detailsLabel: "隱私與使用說明", retention: "每次翻譯的原文與譯文可能會在限定期間內保存，用於品質與安全檢查。" },
  ja: { detailsLabel: "プライバシーと利用案内", retention: "翻訳ごとの原文と翻訳文は、品質・安全確認のため一定期間保存される場合があります。" },
  en: { detailsLabel: "Privacy and use information", retention: "The source and translated text for each translation may be retained for a limited period for quality and safety review." },
  th: { detailsLabel: "ข้อมูลความเป็นส่วนตัวและการใช้งาน", retention: "ข้อความต้นฉบับและคำแปลของแต่ละครั้งอาจถูกเก็บไว้เป็นระยะเวลาจำกัดเพื่อตรวจสอบคุณภาพและความปลอดภัย" },
  ms: { detailsLabel: "Maklumat privasi dan penggunaan", retention: "Teks sumber dan terjemahan bagi setiap terjemahan mungkin disimpan untuk tempoh terhad bagi semakan kualiti dan keselamatan." },
  tl: { detailsLabel: "Impormasyon sa privacy at paggamit", retention: "Maaaring panatilihin sa limitadong panahon ang source at translated text ng bawat salin para sa pagsusuri ng kalidad at kaligtasan." },
  mn: { detailsLabel: "Нууцлал ба ашиглалтын мэдээлэл", retention: "Орчуулга бүрийн эх болон орчуулсан бичвэрийг чанар, аюулгүй байдлын хяналтад зориулан хязгаарлагдмал хугацаанд хадгалж болно." },
  ru: { detailsLabel: "Конфиденциальность и использование", retention: "Исходный и переведенный текст каждого перевода может храниться ограниченное время для проверки качества и безопасности." },
  vi: { detailsLabel: "Thông tin quyền riêng tư và sử dụng", retention: "Văn bản gốc và bản dịch của từng lượt có thể được lưu trong thời gian giới hạn để kiểm tra chất lượng và an toàn." },
  id: { detailsLabel: "Informasi privasi dan penggunaan", retention: "Teks sumber dan terjemahan untuk setiap terjemahan dapat disimpan dalam waktu terbatas untuk peninjauan kualitas dan keamanan." },
  fr: { detailsLabel: "Confidentialité et utilisation", retention: "Le texte source et sa traduction peuvent être conservés pendant une durée limitée à des fins de contrôle de qualité et de sécurité." },
  es: { detailsLabel: "Privacidad e información de uso", retention: "El texto original y su traducción pueden conservarse durante un período limitado para revisar la calidad y la seguridad." },
  de: { detailsLabel: "Datenschutz und Nutzung", retention: "Ausgangstext und Übersetzung können für eine begrenzte Zeit zur Qualitäts- und Sicherheitsprüfung gespeichert werden." },
  it: { detailsLabel: "Privacy e informazioni sull'uso", retention: "Il testo originale e la traduzione possono essere conservati per un periodo limitato per controlli di qualità e sicurezza." },
  pt: { detailsLabel: "Privacidade e informações de uso", retention: "O texto original e a tradução podem ser mantidos por um período limitado para análise de qualidade e segurança." }
};
const patientEntryStateCopy: Record<PatientLanguage, { noAccount: string; processing: string }> = {
  zh: { noAccount: "无需账户", processing: "正在进入，请稍候" }, yue: { noAccount: "毋須帳戶", processing: "正在進入，請稍候" }, zh_tw: { noAccount: "不需帳號", processing: "正在進入，請稍候" },
  ja: { noAccount: "アカウント不要", processing: "入室処理中です" }, en: { noAccount: "No account needed", processing: "Entering the room" }, th: { noAccount: "ไม่ต้องมีบัญชี", processing: "กำลังเข้าห้อง" },
  vi: { noAccount: "Không cần tài khoản", processing: "Đang vào phòng" }, id: { noAccount: "Tanpa akun", processing: "Sedang masuk" }, ms: { noAccount: "Tanpa akaun", processing: "Sedang masuk" },
  tl: { noAccount: "Walang account", processing: "Pumapasok sa room" }, mn: { noAccount: "Бүртгэл хэрэггүй", processing: "Өрөөнд нэвтэрч байна" }, ru: { noAccount: "Без учетной записи", processing: "Вход в комнату" },
  fr: { noAccount: "Aucun compte requis", processing: "Entrée dans la salle" }, es: { noAccount: "Sin cuenta", processing: "Entrando en la sala" }, de: { noAccount: "Kein Konto nötig", processing: "Raum wird geöffnet" },
  it: { noAccount: "Nessun account", processing: "Accesso alla stanza" }, pt: { noAccount: "Sem conta", processing: "Entrando na sala" }
};

export const patientUnavailableCopy: Record<PatientLanguage, { title: string; body: string; recovery: string }> = {
  zh: { title: "无法使用此翻译室", body: "此翻译室已结束、二维码已过期或网络连接失败。", recovery: "请向工作人员索取新的二维码。" }, yue: { title: "此翻譯室未能使用", body: "翻譯室已結束、QR Code 已過期或網絡連線失敗。", recovery: "請向職員索取新的 QR Code。" }, zh_tw: { title: "此翻譯室無法使用", body: "翻譯室已結束、QR Code 已過期或網路連線失敗。", recovery: "請向工作人員索取新的 QR Code。" },
  ja: { title: "この通訳室は利用できません", body: "通訳室が終了したか、QRコードの期限切れ、またはネットワークエラーです。", recovery: "スタッフに新しいQRコードを依頼してください。" }, en: { title: "This interpretation room is unavailable", body: "The room has ended, the QR code expired, or the network connection failed.", recovery: "Please ask the staff for a new QR code." }, th: { title: "ไม่สามารถใช้ห้องล่ามนี้ได้", body: "ห้องสิ้นสุดแล้ว QR หมดอายุ หรือเครือข่ายขัดข้อง", recovery: "กรุณาขอ QR ใหม่จากเจ้าหน้าที่" },
  vi: { title: "Không thể sử dụng phòng phiên dịch này", body: "Phòng đã kết thúc, mã QR hết hạn hoặc có lỗi mạng.", recovery: "Vui lòng yêu cầu nhân viên cung cấp mã QR mới." }, id: { title: "Ruang interpretasi ini tidak tersedia", body: "Ruang telah berakhir, QR kedaluwarsa, atau terjadi gangguan jaringan.", recovery: "Minta kode QR baru kepada staf." }, ms: { title: "Bilik interpretasi ini tidak tersedia", body: "Bilik telah tamat, QR telah luput atau terdapat masalah rangkaian.", recovery: "Minta kod QR baharu daripada staf." },
  tl: { title: "Hindi magagamit ang interpretation room", body: "Tapos na ang room, expired ang QR, o may problema sa network.", recovery: "Humingi ng bagong QR code sa staff." }, mn: { title: "Орчуулгын өрөөг ашиглах боломжгүй", body: "Өрөө дууссан, QR кодын хугацаа дууссан эсвэл сүлжээний алдаа гарсан.", recovery: "Ажилтнаас шинэ QR код авна уу." }, ru: { title: "Этот кабинет перевода недоступен", body: "Сеанс завершен, QR-код истек или произошла ошибка сети.", recovery: "Попросите сотрудника выдать новый QR-код." },
  fr: { title: "Cette salle d’interprétation est indisponible", body: "La session est terminée, le QR code a expiré ou le réseau est indisponible.", recovery: "Demandez un nouveau QR code au personnel." }, es: { title: "Esta sala de interpretación no está disponible", body: "La sesión terminó, el QR caducó o hubo un error de red.", recovery: "Solicite al personal un nuevo código QR." }, de: { title: "Dieser Dolmetschraum ist nicht verfügbar", body: "Die Sitzung ist beendet, der QR-Code ist abgelaufen oder es liegt ein Netzwerkfehler vor.", recovery: "Bitten Sie das Personal um einen neuen QR-Code." },
  it: { title: "Questa sala di interpretariato non è disponibile", body: "La sessione è terminata, il QR è scaduto o si è verificato un errore di rete.", recovery: "Chiedi allo staff un nuovo codice QR." }, pt: { title: "Esta sala de interpretação não está disponível", body: "A sessão terminou, o QR expirou ou ocorreu um erro de rede.", recovery: "Peça à equipe um novo QR code." }
};

const turnTakingNotice: Partial<Record<PatientLanguage, string>> = {
  zh: "请一次只由一位说话。轮到您时再按麦克风。",
  yue: "請一次只由一位說話。輪到您時再按麥克風。",
  zh_tw: "請一次只由一位說話。輪到您時再按麥克風。",
  ja: "一度に一人ずつお話しください。ご自身の順番でマイクを押してください。",
  en: "Please speak one person at a time. Press the microphone only when it is your turn.",
  ms: "Sila bercakap seorang demi seorang. Tekan mikrofon hanya apabila giliran anda.",
  tl: "Magsalita nang isa-isa. Pindutin lang ang mikropono kapag ikaw na ang magsasalita.",
  id: "Harap berbicara satu orang pada satu waktu. Tekan mikrofon hanya saat giliran Anda.",
  fr: "Parlez une seule personne à la fois. Appuyez sur le micro uniquement quand c'est votre tour.",
  es: "Hable una persona a la vez. Pulse el micrófono solo cuando sea su turno.",
  de: "Bitte sprechen Sie immer nur einzeln. Drücken Sie das Mikrofon nur, wenn Sie an der Reihe sind.",
  it: "Parlate una persona alla volta. Premi il microfono solo quando è il tuo turno.",
  pt: "Fale uma pessoa por vez. Toque no microfone apenas quando for a sua vez."
};

export function PatientJoin({
  joinCode,
  room,
  roomMode = "consultation"
}: {
  joinCode: string;
  room: { id: string; patientLanguage: PatientLanguage; hospital: { name: string } };
  roomMode?: "consultation" | "procedure";
}) {
  const text = copy[room.patientLanguage];
  const turnNotice = turnTakingNotice[room.patientLanguage] ?? turnTakingNotice.en;
  const stateCopy = patientEntryStateCopy[room.patientLanguage];
  const privacyCopy = patientPrivacyCopy[room.patientLanguage];
  const [patientTextSize, setPatientTextSize] = usePatientTextSize();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState<{
    id: string;
    status: RoomStatus;
    patientLanguage: PatientLanguage;
    patientJoinedAt?: string | null;
    hospital?: { name: string };
  } | null>(null);

  if (joinedRoom) {
    return <VoiceRoom role="patient" roomMode={roomMode} initialRoom={joinedRoom} />;
  }

  async function enterRoom() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${room.id}/join-patient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode })
      });
      if (!response.ok) throw new Error("Room join failed");
      const data = await response.json() as {
        room?: {
          id: string;
          status: RoomStatus;
          patientLanguage: PatientLanguage;
          patientJoinedAt?: string | null;
          hospital?: { name: string };
        };
      };
      if (!data.room) throw new Error("Room join failed");
      setJoinedRoom(data.room);
      window.history.replaceState(null, "", `/room/patient/${room.id}?mode=${roomMode}`);
      void broadcastRoomUpdate(data.room);
    } catch (caught) {
      setError(roomMode === "procedure" && caught instanceof Error && caught.message === "microphone-unavailable" ? text.denied : text.joinDenied);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section lang={patientLanguageTags[room.patientLanguage]} className={`patient-text-surface ${patientTextSizeClassName(patientTextSize)} overflow-hidden rounded-xl border border-line bg-white shadow-soft`}>
      <div className="bg-ink p-6 text-white sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-blue-200">{room.hospital.name}</p>
            <h1 className="patient-heading-copy mt-3 font-bold leading-tight">{text.title}</h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">
            <ShieldCheck size={15} />
            {stateCopy.noAccount}
          </span>
        </div>
        <p className="patient-body-copy mt-3 font-semibold leading-7 text-slate-300">
          {roomMode === "procedure" ? text.procedureBody : text.body}
        </p>
      </div>

      <div className="mx-6 mt-5 flex justify-end sm:mx-7">
        <PatientTextSizeControl language={room.patientLanguage} value={patientTextSize} onChange={setPatientTextSize} />
      </div>

      <div className="m-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-center sm:m-7">
        <p className="text-xs font-bold text-trust-text">{text.languageLabel}</p>
        <p className="mt-1 break-words text-lg font-bold text-ink">{languageLabels[room.patientLanguage].native}</p>
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-white px-4 py-3 text-left">
          <MessageSquareText size={20} className="mt-0.5 shrink-0 text-trust-text" aria-hidden="true" />
          <div className="patient-body-copy space-y-2 font-semibold leading-7 text-text-secondary">
            <p>{text.consent}</p>
            <p>{privacyCopy.retention}</p>
          </div>
        </div>
        <button
          onClick={enterRoom}
          disabled={loading}
          className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 text-xl font-bold text-white shadow-soft transition hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? <><Loader2 size={22} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />{stateCopy.processing}</> : <>{text.button}<ArrowRight size={22} aria-hidden="true" /></>}
        </button>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-coral-text" role="alert">{error}</p> : null}
      </div>

      <details className="patient-helper-copy group mx-6 mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 font-semibold leading-6 text-text-secondary sm:mx-7 sm:mb-7">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-bold text-trust-text">{privacyCopy.detailsLabel}<ChevronDown size={20} className="transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
        <div className="mt-3 space-y-3">
        <div className="flex gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-trust-text" />
          <p>{roomMode === "procedure" ? text.procedureBody : text.body}</p>
        </div>
        <div className="flex gap-3">
          <MessageSquareText size={20} className="mt-0.5 shrink-0 text-trust-text" aria-hidden="true" />
          <div className="space-y-2">
            <p>{text.consent}</p>
            <p>{privacyCopy.retention}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <MessageSquareText size={20} className="mt-0.5 shrink-0 text-trust-text" />
          <p>{turnNotice}</p>
        </div>
        </div>
      </details>

    </section>
  );
}
