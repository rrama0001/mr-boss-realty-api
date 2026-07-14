-- Add whole-property listing fields to buildings.

ALTER TABLE "buildings"
ADD COLUMN "is_whole_property_listing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "listing_type" TEXT,
ADD COLUMN "sale_price" DOUBLE PRECISION,
ADD COLUMN "monthly_rent" DOUBLE PRECISION,
ADD COLUMN "daily_rent" DOUBLE PRECISION,
ADD COLUMN "hourly_rent" DOUBLE PRECISION;
