export type GlossaryLifecycleEntryForPolicy = {
  entryType: "term" | "critical_phrase" | "transcription_hint" | "verified_sentence";
  standardKo: string;
  category?: string | null;
  note?: string | null;
};

export type GlossaryLifecycleAction = "approve" | "activate" | "new_version" | "retire" | "rollback";

const internallyManagedCategoryPattern = /(?:critical|emergency|consent|contraindication|allerg|pregnan|drug|dose|medication|side.?effect|amount|price|금액|부작용|응급|동의|거부|금기|알레르기|임신|약물|용량)/iu;
const medicallySensitiveTextPattern = /(?:부작용|응급|동의|거부|중단|금기|알레르기|임신|복용량|투여량|마취|출혈|호흡|의식|副作用|緊急|同意|拒否|禁忌|过敏|過敏|妊娠|adverse|emergency|consent|refus|contraindicat|allerg|pregnan|dosage|anesthe|bleeding|breath|conscious)/iu;

export function hospitalAdminCanPerformGlossaryLifecycleAction(
  entry: GlossaryLifecycleEntryForPolicy,
  action: GlossaryLifecycleAction
) {
  if (action === "new_version") return true;
  if (entry.entryType === "critical_phrase" || entry.entryType === "verified_sentence") return false;
  const policyText = `${entry.category ?? ""}\n${entry.standardKo}\n${entry.note ?? ""}`;
  if (internallyManagedCategoryPattern.test(policyText) || medicallySensitiveTextPattern.test(policyText)) return false;
  return entry.entryType === "term" || entry.entryType === "transcription_hint";
}
