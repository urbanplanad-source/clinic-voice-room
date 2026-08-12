import { buildClinicTranscriptionPrompt, realtimeKoreanTranscriptionHints } from "./clinic-glossary";
import { defaultClinicTranscriptionPromptMaxChars } from "./clinic-transcription";
import { medicalTranscriptionContextInstruction } from "./medical-transcription-safety";

export type SttEvaluationHintProfileId =
  | "code-v4"
  | "code-v5-candidate"
  | "code-v5-context-candidate"
  | "code-v6-medical-safety-candidate";

const codeV5CandidateHints = realtimeKoreanTranscriptionHints.map((hint) =>
  hint === "특정 약재" ? "특정 약재에 알레르기가 있나요?" : hint
);

const koreanMedicineDisambiguation =
  "Korean medicine context rule: in '특정 약재에 알레르기가 있나요?' write 약재 (medicinal herb), not 약제 (medicine).";

export function getSttEvaluationHintProfile(profileId: string) {
  if (profileId === "code-v4") {
    return { id: "code-v4" as const, hints: realtimeKoreanTranscriptionHints, extraInstruction: "" };
  }
  if (profileId === "code-v5-candidate") {
    return { id: "code-v5-candidate" as const, hints: codeV5CandidateHints, extraInstruction: "" };
  }
  if (profileId === "code-v5-context-candidate") {
    return {
      id: "code-v5-context-candidate" as const,
      hints: codeV5CandidateHints,
      extraInstruction: koreanMedicineDisambiguation
    };
  }
  if (profileId === "code-v6-medical-safety-candidate") {
    return {
      id: "code-v6-medical-safety-candidate" as const,
      hints: codeV5CandidateHints,
      extraInstruction: medicalTranscriptionContextInstruction
    };
  }
  throw new Error(`Unknown STT hint profile: ${profileId}`);
}

export function buildSttEvaluationPrompt(profileId: string) {
  const profile = getSttEvaluationHintProfile(profileId);
  if (!profile.extraInstruction) {
    return { ...profile, prompt: buildClinicTranscriptionPrompt("ko", profile.hints) };
  }
  const promptBudget = defaultClinicTranscriptionPromptMaxChars - profile.extraInstruction.length - 1;
  const basePrompt = buildClinicTranscriptionPrompt("ko", profile.hints, undefined, promptBudget);
  return { ...profile, prompt: `${basePrompt} ${profile.extraInstruction}` };
}
