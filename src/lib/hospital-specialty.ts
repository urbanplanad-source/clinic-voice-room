export const hospitalSpecialties = [
  "dermatology",
  "plastic_surgery",
  "dental",
  "ophthalmology",
  "neurology",
  "oriental_medicine",
  "general"
] as const;

export type HospitalSpecialty = (typeof hospitalSpecialties)[number];

export const hospitalSpecialtyLabels: Record<HospitalSpecialty, string> = {
  dermatology: "피부과",
  plastic_surgery: "성형외과",
  dental: "치과",
  ophthalmology: "안과",
  neurology: "신경과",
  oriental_medicine: "한의원",
  general: "일반"
};

export function isHospitalSpecialty(value: unknown): value is HospitalSpecialty {
  return typeof value === "string" && hospitalSpecialties.includes(value as HospitalSpecialty);
}

function normalizeForSpecialtyMatch(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, "");
}

export function inferHospitalSpecialtyFromName(hospitalName?: string | null): HospitalSpecialty {
  const normalized = normalizeForSpecialtyMatch(hospitalName ?? "");

  if (normalized.includes("성형") || normalized.includes("plastic") || normalized.includes("surgery")) {
    return "plastic_surgery";
  }
  if (normalized.includes("치과") || normalized.includes("dental")) {
    return "dental";
  }
  if (normalized.includes("안과") || normalized.includes("ophthalm") || normalized.includes("eye")) {
    return "ophthalmology";
  }
  if (normalized.includes("신경") || normalized.includes("neuro")) {
    return "neurology";
  }
  if (normalized.includes("한의") || normalized.includes("한방") || normalized.includes("oriental") || normalized.includes("koreanmedicine")) {
    return "oriental_medicine";
  }
  if (normalized.includes("피부") || normalized.includes("skin") || normalized.includes("derma")) {
    return "dermatology";
  }

  return "general";
}
