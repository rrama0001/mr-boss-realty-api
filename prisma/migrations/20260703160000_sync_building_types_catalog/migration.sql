-- Sync building_types to the expanded alphabetical catalog.

INSERT INTO "building_types" ("name", "sort_order", "is_active", "updated_at") VALUES
('Apartment Building', 1, true, CURRENT_TIMESTAMP),
('Apartelle', 2, true, CURRENT_TIMESTAMP),
('Boarding House', 3, true, CURRENT_TIMESTAMP),
('Bungalow', 4, true, CURRENT_TIMESTAMP),
('Cabin', 5, true, CURRENT_TIMESTAMP),
('Commercial Building', 6, true, CURRENT_TIMESTAMP),
('Condominium', 7, true, CURRENT_TIMESTAMP),
('Cottage', 8, true, CURRENT_TIMESTAMP),
('Detached House', 9, true, CURRENT_TIMESTAMP),
('Dormitory', 10, true, CURRENT_TIMESTAMP),
('Duplex', 11, true, CURRENT_TIMESTAMP),
('Farmhouse', 12, true, CURRENT_TIMESTAMP),
('Fourplex', 13, true, CURRENT_TIMESTAMP),
('Hotel', 14, true, CURRENT_TIMESTAMP),
('Industrial Building', 15, true, CURRENT_TIMESTAMP),
('Mansion', 16, true, CURRENT_TIMESTAMP),
('Mixed-Use Building', 17, true, CURRENT_TIMESTAMP),
('Motel', 18, true, CURRENT_TIMESTAMP),
('Office Building', 19, true, CURRENT_TIMESTAMP),
('Resort', 20, true, CURRENT_TIMESTAMP),
('Retail Building', 21, true, CURRENT_TIMESTAMP),
('Row House', 22, true, CURRENT_TIMESTAMP),
('Semi-Detached House', 23, true, CURRENT_TIMESTAMP),
('Shophouse', 24, true, CURRENT_TIMESTAMP),
('Single-Family House', 25, true, CURRENT_TIMESTAMP),
('Split-Level House', 26, true, CURRENT_TIMESTAMP),
('Three-Storey House', 27, true, CURRENT_TIMESTAMP),
('Townhouse', 28, true, CURRENT_TIMESTAMP),
('Triplex', 29, true, CURRENT_TIMESTAMP),
('Two-Storey House', 30, true, CURRENT_TIMESTAMP),
('Villa', 31, true, CURRENT_TIMESTAMP),
('Warehouse', 32, true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

UPDATE "building_types"
SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "name" NOT IN (
  'Apartment Building',
  'Apartelle',
  'Boarding House',
  'Bungalow',
  'Cabin',
  'Commercial Building',
  'Condominium',
  'Cottage',
  'Detached House',
  'Dormitory',
  'Duplex',
  'Farmhouse',
  'Fourplex',
  'Hotel',
  'Industrial Building',
  'Mansion',
  'Mixed-Use Building',
  'Motel',
  'Office Building',
  'Resort',
  'Retail Building',
  'Row House',
  'Semi-Detached House',
  'Shophouse',
  'Single-Family House',
  'Split-Level House',
  'Three-Storey House',
  'Townhouse',
  'Triplex',
  'Two-Storey House',
  'Villa',
  'Warehouse'
);

-- Normalize legacy building type values on existing buildings
UPDATE "buildings" SET "building_type" = 'Mixed-Use Building' WHERE "building_type" IN ('Mixed', 'Mixed-Use', 'Mixed Use', 'Mixed-Use Residential Development');
UPDATE "buildings" SET "building_type" = 'Commercial Building' WHERE "building_type" IN ('Commercial', 'Commercial Development');
UPDATE "buildings" SET "building_type" = 'Condominium' WHERE "building_type" IN ('Residential', 'Residential Development', 'Residential Tower');
UPDATE "buildings" SET "building_type" = 'Apartment Building' WHERE "building_type" IN ('Apartment', 'Serviced Apartment');
UPDATE "buildings" SET "building_type" = 'Apartelle' WHERE "building_type" = 'Appartelle';
UPDATE "buildings" SET "building_type" = 'Boarding House' WHERE "building_type" IN ('Hostel', 'Pension House');
