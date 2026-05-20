"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageSquareText, Mic, ShieldCheck, Volume2 } from "lucide-react";
import { languageLabels, type PatientLanguage } from "@/lib/languages";
import { broadcastRoomUpdate } from "@/lib/supabase-realtime";

const copy: Record<
  PatientLanguage,
  { title: string; body: string; procedureBody: string; consent: string; button: string; denied: string; languageLabel: string }
> = {
  zh: {
    title: "医院翻译室",
    body: "请允许使用麦克风。不需要安装应用或注册账号。",
    procedureBody: "治疗过程中会播放翻译语音。请保持屏幕开启，并将手机放在身边。",
    consent: "为提供口译服务，您的语音可能会由外部 AI 服务处理。本服务不会保存原始语音或完整对话记录。",
    button: "进入房间",
    denied: "无法使用麦克风。请在浏览器设置中允许麦克风权限。",
    languageLabel: "中文翻译"
  },
  zh_tw: {
    title: "醫院翻譯室",
    body: "請允許使用麥克風。不需要安裝 App 或註冊帳號。",
    procedureBody: "療程中會播放翻譯語音。請保持螢幕開啟，並將手機放在身邊。",
    consent: "為提供口譯服務，您的語音可能會由外部 AI 服務處理。本服務不會保存原始語音或完整對話紀錄。",
    button: "進入房間",
    denied: "無法使用麥克風。請在瀏覽器設定中允許麥克風權限。",
    languageLabel: "繁體中文翻譯"
  },
  ja: {
    title: "病院通訳ルーム",
    body: "マイクの使用を許可してください。アプリのインストールやアカウント登録は不要です。",
    procedureBody: "施術中に通訳音声が再生されます。画面をオンにしたまま、端末をそばに置いてください。",
    consent: "通訳のため、音声が外部AIサービスで処理される場合があります。元の音声や会話全文は保存しません。",
    button: "入室する",
    denied: "マイクを使用できません。ブラウザ設定でマイクの使用を許可してください。",
    languageLabel: "日本語通訳"
  },
  en: {
    title: "Hospital Interpretation Room",
    body: "Please allow microphone access. No app installation or account is required.",
    procedureBody: "Translated audio may play during the procedure. Please keep this screen on and place the phone nearby.",
    consent: "To provide interpretation, your voice may be processed by an external AI service. We do not store raw audio or full conversation transcripts.",
    button: "Enter room",
    denied: "Microphone is unavailable. Please allow microphone access in your browser settings.",
    languageLabel: "English interpretation"
  },
  th: {
    title: "ห้องล่ามของโรงพยาบาล",
    body: "กรุณาอนุญาตให้ใช้ไมโครโฟน ไม่ต้องติดตั้งแอปหรือสมัครบัญชี",
    procedureBody: "ระหว่างทำหัตถการอาจมีเสียงแปล กรุณาเปิดหน้าจอไว้และวางโทรศัพท์ไว้ใกล้ตัว",
    consent: "เพื่อให้บริการล่าม เสียงของคุณอาจถูกประมวลผลโดยบริการ AI ภายนอก เราจะไม่บันทึกเสียงต้นฉบับหรือบทสนทนาทั้งหมด",
    button: "เข้าห้อง",
    denied: "ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาตไมโครโฟนในการตั้งค่าเบราว์เซอร์",
    languageLabel: "ล่ามภาษาไทย"
  },
  ms: {
    title: "Bilik Interpretasi Klinik",
    body: "Sila benarkan akses mikrofon. Tidak perlu memasang aplikasi atau membuat akaun.",
    procedureBody: "Audio terjemahan mungkin dimainkan semasa prosedur. Pastikan skrin kekal hidup dan letakkan telefon berhampiran anda.",
    consent: "Untuk menyediakan interpretasi, suara anda mungkin diproses oleh perkhidmatan AI luaran. Kami tidak menyimpan audio mentah atau transkrip perbualan penuh.",
    button: "Masuk",
    denied: "Mikrofon tidak tersedia. Sila benarkan akses mikrofon dalam tetapan pelayar.",
    languageLabel: "Interpretasi Bahasa Melayu"
  },
  mn: {
    title: "Эмнэлгийн орчуулгын өрөө",
    body: "Микрофон ашиглахыг зөвшөөрнө үү. Апп суулгах эсвэл бүртгэл үүсгэх шаардлагагүй.",
    procedureBody: "Ажилбарын үед орчуулсан дуу тоглож болно. Дэлгэцээ асаалттай байлгаж, утсаа ойрхон тавина уу.",
    consent: "Орчуулга хийхийн тулд таны дуу хоолой гадаад AI үйлчилгээээр боловсруулагдаж болно. Бид эх аудио эсвэл бүтэн ярианы бичвэрийг хадгалахгүй.",
    button: "Өрөөнд орох",
    denied: "Микрофон ашиглах боломжгүй байна. Хөтчийн тохиргооноос микрофоны зөвшөөрлийг нээнэ үү.",
    languageLabel: "Монгол орчуулга"
  },
  ru: {
    title: "Кабинет перевода в клинике",
    body: "Разрешите доступ к микрофону. Установка приложения и регистрация не требуются.",
    procedureBody: "Во время процедуры может воспроизводиться перевод. Оставьте экран включенным и положите телефон рядом.",
    consent: "Для перевода ваш голос может обрабатываться внешним AI-сервисом. Мы не сохраняем исходную аудиозапись или полный текст разговора.",
    button: "Войти",
    denied: "Микрофон недоступен. Разрешите доступ к микрофону в настройках браузера.",
    languageLabel: "Перевод на русский"
  },
  vi: {
    title: "Phòng phiên dịch bệnh viện",
    body: "Vui lòng cho phép truy cập micro. Không cần cài ứng dụng hoặc tạo tài khoản.",
    procedureBody: "Âm thanh phiên dịch có thể được phát trong quá trình thực hiện thủ thuật. Vui lòng để màn hình bật và đặt điện thoại gần bạn.",
    consent: "Để cung cấp phiên dịch, giọng nói của bạn có thể được xử lý bởi dịch vụ AI bên ngoài. Chúng tôi không lưu âm thanh gốc hoặc toàn bộ nội dung cuộc trò chuyện.",
    button: "Vào phòng",
    denied: "Không thể sử dụng micro. Vui lòng cho phép quyền micro trong cài đặt trình duyệt.",
    languageLabel: "Phiên dịch tiếng Việt"
  },
  id: {
    title: "Ruang Interpretasi Klinik",
    body: "Izinkan akses mikrofon. Tidak perlu memasang aplikasi atau membuat akun.",
    procedureBody: "Audio terjemahan dapat diputar selama prosedur. Tetap nyalakan layar dan letakkan ponsel di dekat Anda.",
    consent: "Untuk menyediakan interpretasi, suara Anda dapat diproses oleh layanan AI eksternal. Kami tidak menyimpan audio mentah atau transkrip percakapan lengkap.",
    button: "Masuk",
    denied: "Mikrofon tidak tersedia. Izinkan akses mikrofon di pengaturan browser.",
    languageLabel: "Interpretasi Bahasa Indonesia"
  },
  fr: {
    title: "Salle d'interprétation de la clinique",
    body: "Veuillez autoriser l'accès au microphone. Aucune installation d'application ni création de compte n'est nécessaire.",
    procedureBody: "L'audio traduit peut être diffusé pendant l'intervention. Gardez cet écran allumé et placez le téléphone à proximité.",
    consent: "Pour fournir l'interprétation, votre voix peut être traitée par un service d'IA externe. Nous ne conservons pas l'audio brut ni la transcription complète de la conversation.",
    button: "Entrer",
    denied: "Le microphone n'est pas disponible. Veuillez autoriser l'accès au microphone dans les paramètres du navigateur.",
    languageLabel: "Interprétation en français"
  },
  es: {
    title: "Sala de interpretación de la clínica",
    body: "Permita el acceso al micrófono. No necesita instalar una aplicación ni crear una cuenta.",
    procedureBody: "El audio traducido puede reproducirse durante el procedimiento. Mantenga esta pantalla encendida y coloque el teléfono cerca.",
    consent: "Para ofrecer la interpretación, su voz puede ser procesada por un servicio externo de IA. No guardamos el audio original ni la transcripción completa de la conversación.",
    button: "Entrar",
    denied: "El micrófono no está disponible. Permita el acceso al micrófono en la configuración del navegador.",
    languageLabel: "Interpretación en español"
  },
  de: {
    title: "Dolmetschraum der Klinik",
    body: "Bitte erlauben Sie den Zugriff auf das Mikrofon. Eine App-Installation oder Kontoerstellung ist nicht erforderlich.",
    procedureBody: "Während der Behandlung kann übersetztes Audio abgespielt werden. Lassen Sie den Bildschirm eingeschaltet und legen Sie das Telefon in Ihre Nähe.",
    consent: "Für die Verdolmetschung kann Ihre Stimme von einem externen KI-Dienst verarbeitet werden. Wir speichern weder Roh-Audio noch vollständige Gesprächsprotokolle.",
    button: "Raum betreten",
    denied: "Das Mikrofon ist nicht verfügbar. Bitte erlauben Sie den Mikrofonzugriff in den Browsereinstellungen.",
    languageLabel: "Deutsch-Dolmetschen"
  },
  it: {
    title: "Sala di interpretariato della clinica",
    body: "Consenti l'accesso al microfono. Non è necessario installare un'app o creare un account.",
    procedureBody: "Durante la procedura potrebbe essere riprodotto l'audio tradotto. Tieni lo schermo acceso e il telefono vicino.",
    consent: "Per fornire l'interpretariato, la tua voce può essere elaborata da un servizio IA esterno. Non conserviamo l'audio originale né la trascrizione completa della conversazione.",
    button: "Entra",
    denied: "Il microfono non è disponibile. Consenti l'accesso al microfono nelle impostazioni del browser.",
    languageLabel: "Interpretariato in italiano"
  },
  pt: {
    title: "Sala de interpretação da clínica",
    body: "Permita o acesso ao microfone. Não é necessário instalar aplicativo nem criar conta.",
    procedureBody: "O áudio traduzido pode ser reproduzido durante o procedimento. Mantenha esta tela ligada e coloque o telefone por perto.",
    consent: "Para fornecer a interpretação, sua voz pode ser processada por um serviço externo de IA. Não armazenamos o áudio bruto nem a transcrição completa da conversa.",
    button: "Entrar",
    denied: "O microfone não está disponível. Permita o acesso ao microfone nas configurações do navegador.",
    languageLabel: "Interpretação em português"
  }
};

export function PatientJoin({
  room,
  roomMode = "consultation"
}: {
  room: { id: string; roomToken: string; patientLanguage: PatientLanguage; hospital: { name: string } };
  roomMode?: "consultation" | "procedure";
}) {
  const router = useRouter();
  const text = copy[room.patientLanguage];
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function enterRoom() {
    setLoading(true);
    setError("");
    try {
      if (roomMode === "procedure") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      const response = await fetch(`/api/rooms/${room.id}/join-patient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomToken: room.roomToken })
      });
      if (!response.ok) throw new Error("Room join failed");
      const data = await response.json();
      await broadcastRoomUpdate(data.room);
      router.replace(`/room/${room.roomToken}?mode=${roomMode}`);
    } catch {
      setError(text.denied);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-soft">
      <div className="bg-ink p-6 text-white sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-blue-200">{room.hospital.name}</p>
            <h1 className="mt-3 text-[30px] font-bold leading-tight">{text.title}</h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">
            <ShieldCheck size={15} />
            Guest
          </span>
        </div>
        <p className="mt-3 text-base font-semibold leading-7 text-slate-300">
          {roomMode === "procedure" ? text.procedureBody : text.body}
        </p>
      </div>

      <div className="m-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-center sm:m-7">
        <p className="text-xs font-bold text-trust">{text.languageLabel}</p>
        <p className="mt-1 text-lg font-bold text-ink">{languageLabels[room.patientLanguage].native}</p>
        <button
          onClick={enterRoom}
          disabled={loading}
          className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 text-xl font-bold text-white shadow-soft transition hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "..." : text.button}
          <ArrowRight size={22} />
        </button>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>

      <div className="mx-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-semibold leading-6 text-slate-700 sm:mx-7">
        <div className="flex gap-3">
          <Volume2 size={20} className="mt-0.5 shrink-0 text-trust" />
          <p>{text.consent}</p>
        </div>
      </div>

      <div className="m-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-4 sm:m-7">
        <div>
          <p className="text-xs font-bold text-slate-500">{text.languageLabel}</p>
          <p className="mt-1 text-lg font-bold text-ink">{languageLabels[room.patientLanguage].native}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-trust">
          {roomMode === "procedure" ? <Mic size={22} /> : <MessageSquareText size={22} />}
        </div>
      </div>
    </section>
  );
}
