import { prisma } from "./prisma";
import type { TranslationLanguage } from "./languages";
import type { getCurrentStaff } from "./session";

type StaffSession = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

export async function recordTextTranslationUsage({
  staff,
  sourceLanguage,
  targetLanguage
}: {
  staff: StaffSession;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
}) {
  return prisma.textTranslationUsage.create({
    data: {
      hospitalId: staff.hospitalId,
      staffId: staff.id,
      sourceLanguage,
      targetLanguage
    }
  });
}
