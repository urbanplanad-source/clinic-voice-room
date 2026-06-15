import type { PatientLanguage } from "./languages";

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type VoiceAutoStopOptions = {
  onStop: () => void;
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
  let lastVoiceAt = startedAt;
  let voiceMs = 0;
  let triggered = false;

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
      if (rms >= rmsThreshold || peak >= peakThreshold) {
        voiceMs += deltaMs;
        lastVoiceAt = now;
      }

      if (!triggered && voiceMs >= minVoiceMs && now - startedAt >= minRecordingMs && now - lastVoiceAt >= silenceMs) {
        triggered = true;
        cleanup();
        options.onStop();
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
