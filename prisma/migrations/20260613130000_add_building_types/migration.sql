-- CreateTable
CREATE TABLE "building_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "building_types_name_key" ON "building_types"("name");

-- Seed default building types
INSERT INTO "building_types" ("name", "sort_order", "updated_at") VALUES
('Apartment', 1, CURRENT_TIMESTAMP),
('Condominium', 2, CURRENT_TIMESTAMP),
('Appartelle', 3, CURRENT_TIMESTAMP),
('Boarding House', 4, CURRENT_TIMESTAMP),
('Dormitory', 5, CURRENT_TIMESTAMP),
('Townhouse', 6, CURRENT_TIMESTAMP),
('Serviced Apartment', 7, CURRENT_TIMESTAMP),
('Hotel', 8, CURRENT_TIMESTAMP),
('Resort', 9, CURRENT_TIMESTAMP),
('Hostel', 10, CURRENT_TIMESTAMP),
('Pension House', 11, CURRENT_TIMESTAMP),
('Commercial Building', 12, CURRENT_TIMESTAMP),
('Office Building', 13, CURRENT_TIMESTAMP),
('Mixed-Use Building', 14, CURRENT_TIMESTAMP),
('Warehouse', 15, CURRENT_TIMESTAMP);

-- Normalize legacy building type values on existing buildings
UPDATE "buildings" SET "building_type" = 'Mixed-Use Building' WHERE "building_type" IN ('Mixed', 'Mixed-Use', 'Mixed Use');
UPDATE "buildings" SET "building_type" = 'Commercial Building' WHERE "building_type" IN ('Commercial', 'Commercial Development');
UPDATE "buildings" SET "building_type" = 'Condominium' WHERE "building_type" IN ('Residential', 'Residential Development', 'Residential Tower');
