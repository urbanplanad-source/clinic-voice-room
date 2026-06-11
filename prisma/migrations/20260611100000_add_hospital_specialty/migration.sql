CREATE TYPE "HospitalSpecialty" AS ENUM ('dermatology', 'plastic_surgery', 'dental', 'ophthalmology', 'neurology', 'oriental_medicine', 'general');

ALTER TABLE "Hospital" ADD COLUMN "specialty" "HospitalSpecialty" NOT NULL DEFAULT 'dermatology';
