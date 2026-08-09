import type { PatientLanguage } from "./languages";

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export type VoiceLevelBucket = 0 | 1 | 2 | 3 | 4;

export type VoiceAutoStopOptions = {
  onStop: () => void;
  onLevel?: (bucket: VoiceLevelBucket) => void;
  onNoVoiceChange?: (visible: boolean) => void;
  minRecordingMs?: number;
  minVoiceMs?: number;
  silenceMs?: number;
  rmsThreshold?: number;
  peakThreshold?: number;
};

const defaultOptions = {
  minRecordingMs: 1000,
  minVoiceMs: 220,
  silenceMs: 1600,
  rmsThreshold: 0.018,
  peakThreshold: 0.06
};

export const patientAutoStopSpeakingCopy: Record<PatientLanguage, string> = {
  zh: "说完后会自动翻译",
  yue: "講完後會自動翻譯",
  zh_tw: "說完後會自動翻譯",
  ja: "話し終わると自動翻訳します",
  en: "Auto-translates when you finish speaking",
  th: "พูดจบแล้วจะแปลให้อัตโนมัติ",
  ms: "Terjemahan automatik selepas anda selesai bercakap",
  mn: "Яриа дуусмагц автоматаар орчуулна",
  ru: "После окончания речи перевод начнется автоматически",
  vi: "Nói xong sẽ tự động dịch",
  id: "Otomatis menerjemahkan setelah Anda selesai berbicara",
  tl: "Awtomatikong isasalin kapag tapos ka nang magsalita",
  fr: "Traduction automatique quand vous avez terminé",
  es: "Se traducirá automáticamente al terminar de hablar",
  de: "Automatische Übersetzung nach dem Sprechen",
  it: "Traduce automaticamente quando finisci di parlare",
  pt: "Traduz automaticamente quando você terminar de falar"
};

export const patientAutoStopHelperCopy: Record<PatientLanguage, string> = {
  zh: "请说完后稍等。",
  yue: "講完後請稍等。",
  zh_tw: "說完後請稍等。",
  ja: "話し終わったら少しお待ちください。",
  en: "Please wait briefly after you finish.",
  th: "พูดจบแล้วกรุณารอสักครู่",
  ms: "Sila tunggu sebentar selepas selesai bercakap.",
  mn: "Ярьж дуусаад түр хүлээнэ үү.",
  ru: "После окончания речи немного подождите.",
  vi: "Vui lòng chờ một chút sau khi nói xong.",
  id: "Mohon tunggu sebentar setelah selesai berbicara.",
  tl: "Pakihintay sandali pagkatapos magsalita.",
  fr: "Veuillez patienter un instant après avoir parlé.",
  es: "Espere un momento después de hablar.",
  de: "Bitte warten Sie kurz, nachdem Sie gesprochen haben.",
  it: "Attendi un momento dopo aver parlato.",
  pt: "Aguarde um momento depois de falar."
};

export const patientNoVoiceCopy: Record<PatientLanguage, string> = {
  zh: "声音较小或尚未检测到声音。",
  yue: "聲音較細或暫時未偵測到聲音。",
  zh_tw: "聲音較小或尚未偵測到聲音。",
  ja: "音声が小さいか、まだ検出されていません。",
  en: "The sound is quiet or has not been detected yet.",
  th: "เสียงเบาหรือยังตรวจไม่พบเสียง",
  vi: "Âm thanh nhỏ hoặc chưa được phát hiện.",
  id: "Suara pelan atau belum terdeteksi.",
  ms: "Suara perlahan atau belum dikesan.",
  tl: "Mahina ang tunog o hindi pa ito natutukoy.",
  mn: "Дуу сул эсвэл хараахан илрээгүй байна.",
  ru: "Звук тихий или пока не обнаружен.",
  fr: "Le son est faible ou n'a pas encore été détecté.",
  es: "El sonido es bajo o todavía no se ha detectado.",
  de: "Der Ton ist leise oder wurde noch nicht erkannt.",
  it: "Il suono è basso o non è ancora stato rilevato.",
  pt: "O som está baixo ou ainda não foi detectado."
};

function safelyNotify<T>(callback: ((value: T) => void) | undefined, value: T) {
  try {
    callback?.(value);
  } catch {
    // UI feedback must never interrupt recording or automatic stop.
  }
}

export function voiceLevelBucket(
  rms: number,
  peak: number,
  rmsThreshold = defaultOptions.rmsThreshold,
  peakThreshold = defaultOptions.peakThreshold
): VoiceLevelBucket {
  const ratio = Math.max(rms / rmsThreshold, peak / peakThreshold);
  if (ratio < 0.35) return 0;
  if (ratio < 0.65) return 1;
  if (ratio < 1) return 2;
  if (ratio < 2) return 3;
  return 4;
}

export function createVoiceActivityTracker(options: {
  startedAt: number;
  minRecordingMs: number;
  minVoiceMs: number;
  silenceMs: number;
  rmsThreshold: number;
  peakThreshold: number;
  noVoiceWarningMs?: number;
  onLevel?: (bucket: VoiceLevelBucket) => void;
  onNoVoiceChange?: (visible: boolean) => void;
}) {
  let lastVoiceAt = options.startedAt;
  let voiceMs = 0;
  let lastLevel: VoiceLevelBucket | null = null;
  let noVoiceVisible = false;
  const noVoiceWarningMs = options.noVoiceWarningMs ?? 2500;

  return {
    sample(params: { now: number; deltaMs: number; rms: number; peak: number }) {
      const detected = params.rms >= options.rmsThreshold || params.peak >= options.peakThreshold;
      const level = voiceLevelBucket(params.rms, params.peak, options.rmsThreshold, options.peakThreshold);

      if (level !== lastLevel) {
        lastLevel = level;
        safelyNotify(options.onLevel, level);
      }

      if (detected) {
        voiceMs += Math.max(0, params.deltaMs);
        lastVoiceAt = params.now;
        if (noVoiceVisible) {
          noVoiceVisible = false;
          safelyNotify(options.onNoVoiceChange, false);
        }
      } else if (!noVoiceVisible && voiceMs === 0 && params.now - options.startedAt >= noVoiceWarningMs) {
        noVoiceVisible = true;
        safelyNotify(options.onNoVoiceChange, true);
      }

      return (
        voiceMs >= options.minVoiceMs &&
        params.now - options.startedAt >= options.minRecordingMs &&
        params.now - lastVoiceAt >= options.silenceMs
      );
    }
  };
}
export function startVoiceAutoStop(stream: MediaStream, options: VoiceAutoStopOptions) {
  if (typeof window === "undefined") return () => undefined;

  const AudioContextCtor = window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return () => undefined;

  const minRecordingMs = options.minRecordingMs ?? defaultOptions.minRecordingMs;
  const minVoiceMs = options.minVoiceMs ?? defaultOptions.minVoiceMs;
  const silenceMs = options.silenceMs ?? defaultOptions.silenceMs;
  const rmsThreshold = options.rmsThreshold ?? defaultOptions.rmsThreshold;
  const peakThreshold = options.peakThreshold ?? defaultOptions.peakThreshold;

  let stopped = false;
  let animationFrame = 0;
  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  const startedAt = Date.now();
  let lastTickAt = startedAt;
  let triggered = false;
  const tracker = createVoiceActivityTracker({
    startedAt,
    minRecordingMs,
    minVoiceMs,
    silenceMs,
    rmsThreshold,
    peakThreshold,
    onLevel: options.onLevel,
    onNoVoiceChange: options.onNoVoiceChange
  });

  try {
    audioContext = new AudioContextCtor();
    source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      safelyNotify(options.onLevel, 0);
      try {
        source?.disconnect();
      } catch {
        // Audio monitor cleanup should not affect the active recording stream.
      }
      void audioContext?.close().catch(() => undefined);
    };

    const tick = () => {
      if (stopped) return;

      analyser.getFloatTimeDomainData(samples);
      const now = Date.now();
      const deltaMs = Math.max(0, now - lastTickAt);
      lastTickAt = now;

      let sumSquares = 0;
      let peak = 0;
      for (const sample of samples) {
        const magnitude = Math.abs(sample);
        if (magnitude > peak) peak = magnitude;
        sumSquares += sample * sample;
      }

      const rms = Math.sqrt(sumSquares / samples.length);
      if (!triggered && tracker.sample({ now, deltaMs, rms, peak })) {
        triggered = true;
        cleanup();
        safelyNotify(options.onStop, undefined);
        return;
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    void audioContext.resume().catch(() => undefined);
    animationFrame = window.requestAnimationFrame(tick);
    return cleanup;
  } catch {
    try {
      source?.disconnect();
    } catch {
      // Ignore unsupported browser monitor cleanup.
    }
    void audioContext?.close().catch(() => undefined);
    return () => undefined;
  }
}