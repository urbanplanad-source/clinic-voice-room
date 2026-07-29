-- These tables are accessed through the server's direct Prisma connection only.
-- Keep them unreachable from Supabase's public Data API roles.
alter table public."GlossaryEntry" enable row level security;
alter table public."HospitalQuickPhrase" enable row level security;
alter table public."TranslationFeedback" enable row level security;
alter table public."_prisma_migrations" enable row level security;

revoke all privileges on table public."GlossaryEntry" from anon, authenticated;
revoke all privileges on table public."HospitalQuickPhrase" from anon, authenticated;
revoke all privileges on table public."TranslationFeedback" from anon, authenticated;
revoke all privileges on table public."_prisma_migrations" from anon, authenticated;
