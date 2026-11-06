require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { seedUnitTypes } = require('../services/unitTypes');
const { seedBuildingTypes } = require('../services/buildingTypes');
const { backfillProjectSlugs } = require('../services/projectSlug');
const { backfillUnitSlugs } = require('../services/unitSlug');
const { backfillBuildingSlugs } = require('../services/buildingSlug');
const prisma = new PrismaClient();

const LOT_COVER_IMAGES = {
  residential: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
  commercial: 'https://images.unsplash.com/photo-1464146072230-91cabc968266?w=1200&q=80',
  vacant: 'https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=1200&q=80',
  agricultural: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
};

function assertSeedAllowed() {
  const allowSeed = ['1', 'true', 'yes'].includes(
    String(process.env.ALLOW_DB_SEED || '').trim().toLowerCase(),
  );
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL || '';
  const isProduction = nodeEnv === 'production';
  const isRemoteDb = Boolean(databaseUrl)
    && !/@(localhost|127\.0\.0\.1)(:|\/|$)/i.test(databaseUrl);

  if (allowSeed) {
    return;
  }

  if (isProduction || isRemoteDb) {
    const reasons = [];
    if (isProduction) reasons.push('NODE_ENV=production');
    if (isRemoteDb) reasons.push('DATABASE_URL points to a remote database');

    console.error('❌ Seed blocked for safety.');
    console.error(`   Reason: ${reasons.join('; ')}.`);
    console.error('   Seeding is only allowed against local Postgres by default.');
    console.error('   To override intentionally, set ALLOW_DB_SEED=true and re-run.');
    process.exit(1);
  }
}

async function main() {
  assertSeedAllowed();
  console.log('🌱 Seeding database...');

  await seedUnitTypes();
  console.log('✅ Unit types seeded');

  await seedBuildingTypes();
  console.log('✅ Building types seeded');

  await prisma.company_profile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      company_name: 'Mr. Boss Realty',
      tagline: 'The smarter way to find condos, houses, and rentals—anywhere, anytime.',
      email: 'hello@mrbossrealty.com',
      phone: '+63 917 000 0000',
      address: 'Cebu City, Philippines',
      city: 'Cebu City',
      business_hours: '8:00 AM – 6:00 PM, Mon–Sat',
      website_url: 'https://www.mrbossrealty.com',
    },
  });
  console.log('✅ Company profile seeded');
  
  // --- USERS ---
  const existingAdmin = await prisma.users.findFirst({
    where: { email: 'geraldlaput_mrbossrealty@gmail.com' },
  });
  if (!existingAdmin) {
    await prisma.users.create({
      data: {
        full_name: 'Gerald Laput',
        email: 'geraldlaput_mrbossrealty@gmail.com',
        password: await bcrypt.hash('GL_mrbossRealty@2025', 10),
        role: 'admin',
        notify_email: false,
        notify_sms: false,
        notify_facebook: false,
      },
    });
  }

  // --- PROJECTS ---
  const projectSeed = [
    {
      project_name: 'Avida Towers One',
      developer: 'Avida Land Corp',
      city: 'Makati City',
      location: 'Makati City',
      description: 'Mid-rise condo with complete amenities.',
      contact_person: 'John Doe',
      contact_person_position: 'Sales Manager',
      contact_person_number: '09171234567',
      contact_person_email: 'john@avida.com',
      loan_type: 'Bank Financing',
      reservation_requirements: 'Valid ID, Proof of Billing, Reservation Fee',
      is_featured: true,
      featured_sort_order: 1,
    },
    {
      project_name: 'Avida Towers Two',
      developer: 'Avida Land Corp',
      city: 'Taguig City',
      location: 'Bonifacio Global City',
      description: 'High-rise residential condominium.',
      contact_person: 'Jane Smith',
      contact_person_position: 'Project Consultant',
      contact_person_number: '09179876543',
      contact_person_email: 'jane@avida.com',
      loan_type: 'In-house Financing',
      reservation_requirements: '2 Valid IDs, Proof of Income',
      is_featured: true,
      featured_sort_order: 2,
    },
    {
      project_name: 'Avida Residences',
      developer: 'Avida Land Corp',
      city: 'Cebu City',
      location: 'Cebu City',
      description: 'Exclusive gated community with modern homes.',
      contact_person: 'Mark Lee',
      contact_person_position: 'Broker',
      contact_person_number: '09998887777',
      contact_person_email: 'mark@avida.com',
      loan_type: 'Pag-IBIG',
      reservation_requirements: 'Reservation Form, ID, Proof of Billing',
      is_featured: true,
      featured_sort_order: 3,
    },
  ];

  for (const project of projectSeed) {
    const existing = await prisma.projects.findFirst({
      where: { project_name: project.project_name },
    });
    if (existing) {
      await prisma.projects.update({
        where: { id: existing.id },
        data: {
          is_featured: true,
          featured_sort_order: project.featured_sort_order,
          city: project.city,
          location: project.location,
        },
      });
    } else {
      await prisma.projects.create({ data: project });
    }
  }

  const allProjects = await prisma.projects.findMany();

  // --- BUILDINGS ---
  for (const project of allProjects) {
    const buildingCount = await prisma.buildings.count({ where: { project_id: project.id } });
    if (buildingCount > 0) continue;

    await prisma.buildings.createMany({
      data: [
        {
          project_id: project.id,
          building_type: 'Mixed-Use Building',
          building_name: 'Tower A',
          number_of_units: 50,
          lts_completion_date: new Date('2025-06-01'),
          cts_completion_date: new Date('2026-06-01'),
          total_available_units: 45,
          total_parking: 20,
          total_available_parking: 18,
          freebies: 'Furniture package',
          status: 'Ready for Occupancy',
        },
        {
          project_id: project.id,
          building_type: 'Condominium',
          building_name: 'Tower B',
          number_of_units: 60,
          lts_completion_date: new Date('2024-12-01'),
          cts_completion_date: new Date('2025-12-01'),
          total_available_units: 50,
          total_parking: 25,
          total_available_parking: 20,
          status: 'Ready for Occupancy',
        },
        {
          project_id: project.id,
          building_type: 'Commercial Building',
          building_name: 'Podium',
          number_of_units: 30,
          lts_completion_date: new Date('2025-03-01'),
          cts_completion_date: new Date('2025-09-01'),
          total_available_units: 25,
          total_parking: 10,
          total_available_parking: 8,
          freebies: 'Fit-out allowance',
          status: 'Under Construction',
        },
      ],
    });
  }

  const allBuildings = await prisma.buildings.findMany();

  // --- UNITS ---
  for (const building of allBuildings) {
    const unitCount = await prisma.units.count({ where: { building_id: building.id } });
    if (unitCount > 0) continue;

    await prisma.units.createMany({
      data: [
        {
          project_id: building.project_id,
          building_id: building.id,
          floor: 5,
          room_number: '501',
          unit_type: '1 Bedroom',
          unit_size: '35',
          bedrooms: 1,
          bathrooms: 1,
          listing_type: 'sale',
          unit_price: Math.floor(Math.random() * 9000000) + 1000000,
          payment_terms: '20% DP, 80% bank',
          payment_terms_link: 'https://avida.com/payment-terms',
          reservation_fee: 20000,
          is_reservation_deductible: true,
          monthly_dues_per_sqm: 100,
          monthly_dues: 3500,
          is_pet_allowed: true,
          allowed_pet_size: 'small',
          is_allowed_smoking: false,
        },
        {
          project_id: building.project_id,
          building_id: building.id,
          floor: 10,
          room_number: '1002',
          unit_type: '2 Bedroom',
          unit_size: '55',
          bedrooms: 2,
          bathrooms: 2,
          listing_type: 'sale',
          unit_price: Math.floor(Math.random() * 9000000) + 1000000,
          payment_terms: '10% DP, 90% bank',
          payment_terms_link: 'https://avida.com/payment-terms',
          reservation_fee: 30000,
          is_reservation_deductible: true,
          monthly_dues_per_sqm: 100,
          monthly_dues: 5500,
          is_pet_allowed: false,
          allowed_pet_size: 'none',
          is_allowed_smoking: false,
        },
        {
          project_id: building.project_id,
          building_id: building.id,
          floor: 15,
          room_number: '1503',
          unit_type: 'Studio',
          unit_size: '25',
          bedrooms: 0,
          bathrooms: 1,
          listing_type: 'rent',
          monthly_rent: Math.floor(Math.random() * 40000) + 15000,
          payment_terms: '1 month advance, 2 months deposit',
          payment_terms_link: 'https://avida.com/payment-terms',
          reservation_fee: 15000,
          is_reservation_deductible: false,
          monthly_dues_per_sqm: 100,
          monthly_dues: 2500,
          is_pet_allowed: true,
          allowed_pet_size: 'small',
          is_allowed_smoking: true,
        },
      ],
    });
  }

  const allUnits = await prisma.units.findMany();

  // --- DELIVERABLES ---
  for (const unit of allUnits) {
    await prisma.deliverables.createMany({
      data: [
        {
          project_id: unit.project_id,
          building_id: unit.building_id,
          unit_id: unit.id,
          item: 'Painted Walls',
          item_type: 'Interior',
        },
        {
          project_id: unit.project_id,
          building_id: unit.building_id,
          unit_id: unit.id,
          item: 'Kitchen Cabinets',
          item_type: 'Furnishing',
        },
        {
          project_id: unit.project_id,
          building_id: unit.building_id,
          unit_id: unit.id,
          item: 'Bathroom Fixtures',
          item_type: 'Plumbing',
        },
      ],
    });
  }

  // --- ASSETS ---
  for (const unit of allUnits) {
    const assetCount = await prisma.assets.count({ where: { unit_id: unit.id } });
    if (assetCount > 0) continue;

    await prisma.assets.createMany({
      data: [
        {
          project_id: unit.project_id,
          unit_id: unit.id,
          kind: 'image',
          image_label: 'Living area',
          image_link: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
        },
        {
          project_id: unit.project_id,
          unit_id: unit.id,
          kind: 'image',
          image_label: 'Bedroom',
          image_link: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
        },
      ],
    });
  }

  for (const project of allProjects) {
    const projectAssetCount = await prisma.assets.count({
      where: { project_id: project.id, unit_id: null },
    });
    if (projectAssetCount > 0) continue;

    await prisma.assets.create({
      data: {
        project_id: project.id,
        kind: 'image',
        image_label: 'Cover',
        image_link: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
      },
    });
  }

  // --- LOT LISTINGS (whole-property buildings) ---
  // 2 for sale + 2 for lease (DB listing_type uses sale/rent)
  const lotSeed = [
    {
      project_name: 'Southridge Residential Lot',
      developer: 'Mr. Boss Realty',
      city: 'Cebu City',
      location: 'Banilad, Cebu City',
      description: 'Prime residential lot in a quiet neighborhood, ready for your dream home.',
      status: 'Available',
      cover_image_url: LOT_COVER_IMAGES.residential,
      building: {
        building_name: 'Southridge Lot',
        building_type: 'Residential Lot',
        status: 'Ready for Occupancy',
        is_whole_property_listing: true,
        listing_type: 'sale',
        sale_price: 4500000,
        lot_area: '200',
        payment_terms: '20% DP, balance via bank financing',
        reservation_fee: 50000,
        is_reservation_deductible: true,
      },
    },
    {
      project_name: 'IT Park Commercial Lot',
      developer: 'Mr. Boss Realty',
      city: 'Cebu City',
      location: 'Cebu IT Park vicinity',
      description: 'Corner commercial lot ideal for retail, office, or mixed-use development.',
      status: 'Available',
      cover_image_url: LOT_COVER_IMAGES.commercial,
      building: {
        building_name: 'IT Park Corner Lot',
        building_type: 'Commercial Lot',
        status: 'Ready for Occupancy',
        is_whole_property_listing: true,
        listing_type: 'sale',
        sale_price: 18500000,
        lot_area: '350',
        payment_terms: 'Cash or bank financing',
        reservation_fee: 100000,
        is_reservation_deductible: true,
      },
    },
    {
      project_name: 'Mactan Vacant Lot Lease',
      developer: 'Mr. Boss Realty',
      city: 'Lapu-Lapu City',
      location: 'Mactan, Lapu-Lapu City',
      description: 'Vacant lot available for long-term lease near the airport corridor.',
      status: 'Available',
      cover_image_url: LOT_COVER_IMAGES.vacant,
      building: {
        building_name: 'Mactan Vacant Lot',
        building_type: 'Vacant Lot',
        status: 'Ready for Occupancy',
        is_whole_property_listing: true,
        listing_type: 'rent',
        monthly_rent: 85000,
        lot_area: '500',
        payment_terms: '3 months deposit, 1 month advance',
        reservation_fee: 85000,
        is_reservation_deductible: false,
      },
    },
    {
      project_name: 'Carcar Agricultural Land Lease',
      developer: 'Mr. Boss Realty',
      city: 'Carcar City',
      location: 'Carcar City, Cebu',
      description: 'Agricultural land for lease—suitable for farming or agribusiness use.',
      status: 'Available',
      cover_image_url: LOT_COVER_IMAGES.agricultural,
      building: {
        building_name: 'Carcar Farm Lot',
        building_type: 'Agricultural Land',
        status: 'Ready for Occupancy',
        is_whole_property_listing: true,
        listing_type: 'rent',
        monthly_rent: 25000,
        lot_area: '5000',
        payment_terms: 'Annual lease preferred; monthly terms available',
        reservation_fee: 25000,
        is_reservation_deductible: false,
      },
    },
  ];

  for (const lot of lotSeed) {
    const { building, ...projectData } = lot;
    let project = await prisma.projects.findFirst({
      where: { project_name: projectData.project_name },
    });

    if (project) {
      project = await prisma.projects.update({
        where: { id: project.id },
        data: {
          city: projectData.city,
          location: projectData.location,
          description: projectData.description,
          developer: projectData.developer,
          status: projectData.status,
          cover_image_url: projectData.cover_image_url,
          is_featured: false,
          is_private_on_website: false,
        },
      });
    } else {
      project = await prisma.projects.create({
        data: {
          ...projectData,
          is_featured: false,
          is_private_on_website: false,
        },
      });
    }

    const existingBuilding = await prisma.buildings.findFirst({
      where: {
        project_id: project.id,
        building_name: building.building_name,
      },
    });

    if (existingBuilding) {
      await prisma.buildings.update({
        where: { id: existingBuilding.id },
        data: building,
      });
    } else {
      await prisma.buildings.create({
        data: {
          project_id: project.id,
          ...building,
        },
      });
    }

    const projectAssetCount = await prisma.assets.count({
      where: { project_id: project.id, unit_id: null },
    });
    if (projectAssetCount === 0 && projectData.cover_image_url) {
      await prisma.assets.create({
        data: {
          project_id: project.id,
          kind: 'image',
          image_label: 'Cover',
          image_link: projectData.cover_image_url,
        },
      });
    }
  }
  console.log('✅ Lot listings seeded (2 sale, 2 lease)');

  await backfillProjectSlugs(prisma);
  console.log('✅ Project slugs backfilled');

  await backfillUnitSlugs(prisma);
  console.log('✅ Unit slugs backfilled');

  await backfillBuildingSlugs(prisma);
  console.log('✅ Building slugs backfilled');

  console.log('✅ Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
