-- CreateTable
CREATE TABLE "website_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "property_page_records_per_page" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "website_settings_property_page_records_per_page_check"
        CHECK ("property_page_records_per_page" BETWEEN 1 AND 100)
);

-- Seed singleton website settings
INSERT INTO "website_settings" (
    "id",
    "property_page_records_per_page",
    "created_at",
    "updated_at"
) VALUES (
    1,
    15,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
