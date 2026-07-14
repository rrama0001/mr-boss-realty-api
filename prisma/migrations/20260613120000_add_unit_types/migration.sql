-- CreateTable
CREATE TABLE "unit_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_types_name_key" ON "unit_types"("name");

-- Seed default unit types
INSERT INTO "unit_types" ("name", "sort_order", "updated_at") VALUES
('Studio', 1, CURRENT_TIMESTAMP),
('Standard Room', 2, CURRENT_TIMESTAMP),
('1 Bedroom', 3, CURRENT_TIMESTAMP),
('2 Bedroom', 4, CURRENT_TIMESTAMP),
('3 Bedroom', 5, CURRENT_TIMESTAMP),
('Loft', 6, CURRENT_TIMESTAMP),
('Penthouse', 7, CURRENT_TIMESTAMP),
('Hotel Room', 8, CURRENT_TIMESTAMP),
('Deluxe Room', 9, CURRENT_TIMESTAMP),
('Suite', 10, CURRENT_TIMESTAMP),
('Executive Suite', 11, CURRENT_TIMESTAMP),
('Presidential Suite', 12, CURRENT_TIMESTAMP),
('Retail Space', 13, CURRENT_TIMESTAMP),
('Office Space', 14, CURRENT_TIMESTAMP),
('Warehouse', 15, CURRENT_TIMESTAMP),
('Storage Unit', 16, CURRENT_TIMESTAMP),
('Showroom', 17, CURRENT_TIMESTAMP),
('Restaurant Space', 18, CURRENT_TIMESTAMP),
('Kiosk', 19, CURRENT_TIMESTAMP),
('Function Room', 20, CURRENT_TIMESTAMP),
('Conference Room', 21, CURRENT_TIMESTAMP),
('Meeting Room', 22, CURRENT_TIMESTAMP),
('Event Hall', 23, CURRENT_TIMESTAMP),
('Parking Slot', 24, CURRENT_TIMESTAMP),
('Motorcycle Parking', 25, CURRENT_TIMESTAMP),
('Storage Locker', 26, CURRENT_TIMESTAMP);

-- Normalize legacy unit type values on existing units
UPDATE "units" SET "unit_type" = '1 Bedroom' WHERE "unit_type" IN ('1BR', '1 BR', '1-Bedroom');
UPDATE "units" SET "unit_type" = '2 Bedroom' WHERE "unit_type" IN ('2BR', '2 BR', '2-Bedroom');
UPDATE "units" SET "unit_type" = '3 Bedroom' WHERE "unit_type" IN ('3BR', '3 BR', '3-Bedroom');
UPDATE "units" SET "unit_type" = 'Studio' WHERE "unit_type" ILIKE 'studio%';
