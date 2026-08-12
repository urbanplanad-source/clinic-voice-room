import {
  medicalTranscriptionSafetyEnabled,
  resolveMedicalTranscriptionSafety
} from "./medical-transcription-safety";

type TranscriptionResponse = { text?: string };

export async function retranscribeMedicalAudio(params: {
  apiKey: string;
  audio: Blob;
  fileName: string;
  model: string;
  language?: string;
  prompt: string;
  safetyIdentifier: string;
  timeoutMs?: number;
}) {
  const form = new FormData();
  form.set("file", params.audio, params.fileName);
  form.set("model", params.model);
  if (params.language) form.set("language", params.language);
  form.set("response_format", "json");
  form.set("prompt", params.prompt);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "OpenAI-Safety-Identifier": params.safetyIdentifier
    },
    body: form,
    signal: AbortSignal.timeout(Math.max(1_000, Math.min(params.timeoutMs ?? 8_000, 12_000)))
  });
  if (!response.ok) return null;
  const data = (await response.json()) as TranscriptionResponse;
  return data.text?.trim() || null;
}

export async function resolveUploadedMedicalTranscription(params: {
  transcript: string;
  inputLanguage: string;
  apiKey: string;
  audio: Blob;
  fileName: string;
  model: string;
  language?: string;
  safetyIdentifier: string;
}) {
  return resolveMedicalTranscriptionSafety({
    transcript: params.transcript,
    inputLanguage: params.inputLanguage,
    enabled: medicalTranscriptionSafetyEnabled(),
    retranscribe: (prompt) => retranscribeMedicalAudio({
      apiKey: params.apiKey,
      audio: params.audio,
      fileName: params.fileName,
      model: params.model,
      language: params.language,
      prompt,
      safetyIdentifier: params.safetyIdentifier
    })
  });
}
