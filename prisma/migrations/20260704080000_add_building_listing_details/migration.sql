ALTER TABLE "buildings"
ADD COLUMN "lot_area" TEXT,
ADD COLUMN "payment_terms" TEXT,
ADD COLUMN "payment_terms_link" TEXT,
ADD COLUMN "reservation_fee" DOUBLE PRECISION,
ADD COLUMN "is_reservation_deductible" BOOLEAN,
ADD COLUMN "monthly_dues" DOUBLE PRECISION,
ADD COLUMN "monthly_dues_per_sqm" DOUBLE PRECISION,
ADD COLUMN "is_pet_allowed" BOOLEAN,
ADD COLUMN "allowed_pet_size" TEXT,
ADD COLUMN "is_allowed_smoking" BOOLEAN,
ADD COLUMN "images_videos_link" TEXT;
