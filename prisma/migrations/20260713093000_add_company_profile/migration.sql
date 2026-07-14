-- CreateTable
CREATE TABLE "company_profile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "company_name" TEXT,
    "tagline" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "business_hours" TEXT,
    "facebook_url" TEXT,
    "messenger_url" TEXT,
    "instagram_url" TEXT,
    "website_url" TEXT,
    "maps_url" TEXT,
    "legal_name" TEXT,
    "privacy_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

-- Seed default public contact details
INSERT INTO "company_profile" (
    "id",
    "company_name",
    "tagline",
    "email",
    "phone",
    "address",
    "city",
    "business_hours",
    "website_url",
    "created_at",
    "updated_at"
) VALUES (
    1,
    'Mr. Boss Realty',
    'The smarter way to find your next property—anywhere, anytime.',
    'hello@mrbossrealty.com',
    '+63 917 000 0000',
    'Cebu City, Philippines',
    'Cebu City',
    '8:00 AM – 6:00 PM, Mon–Sat',
    'https://www.mrbossrealty.com',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
