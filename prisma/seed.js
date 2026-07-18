const { PrismaClient } = require('@prisma/client');
const { seedUnitTypes } = require('../services/unitTypes');
const { seedBuildingTypes } = require('../services/buildingTypes');
const { backfillProjectSlugs } = require('../services/projectSlug');
const { backfillUnitSlugs } = require('../services/unitSlug');
const prisma = new PrismaClient();

async function main() {
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
  await prisma.users.create({
    data: {
      username: "Gerald Laput",
      email: "geraldlaput_mrbossrealty@gmail.com",
      password: "GL_mrbossRealty@2025",
      role: "admin",
    },
  });

  // --- PROJECTS ---
  await prisma.projects.createMany({
    data: [
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
      },
    ],
  });

  const allProjects = await prisma.projects.findMany();

  // --- BUILDINGS ---
  for (const project of allProjects) {
    await prisma.buildings.createMany({
      data: [
        {
          project_id: project.id,
          building_type: 'Mixed-Use Building',
          building_name: 'Tower A',
          number_of_units: 50,
          lts_completion_date: new Date('2025-06-01'),
          cts_completion_date: new Date('2026-06-01'),
          total_units: 50,
          total_available_units: 45,
          total_parking: 20,
          total_available_parking: 18,
          has_freebies: true,
        },
        {
          project_id: project.id,
          building_type: 'Condominium',
          building_name: 'Tower B',
          number_of_units: 60,
          lts_completion_date: new Date('2024-12-01'),
          cts_completion_date: new Date('2025-12-01'),
          total_units: 60,
          total_available_units: 50,
          total_parking: 25,
          total_available_parking: 20,
          has_freebies: false,
        },
        {
          project_id: project.id,
          building_type: 'Commercial Building',
          building_name: 'Podium',
          number_of_units: 30,
          lts_completion_date: new Date('2025-03-01'),
          cts_completion_date: new Date('2025-09-01'),
          total_units: 30,
          total_available_units: 25,
          total_parking: 10,
          total_available_parking: 8,
          has_freebies: true,
        },
      ],
    });
  }

  const allBuildings = await prisma.buildings.findMany();

  // --- UNITS ---
  for (const building of allBuildings) {
    await prisma.units.createMany({
      data: [
        {
          project_id: building.project_id,
          building_id: building.id,
          floor: 5,
          room_number: '501',
          unit_type: '1 Bedroom',
          unit_size: 35,
          bedrooms: 1,
          bathrooms: 1,
          unit_price: Math.floor(Math.random() * 9000000) + 1000000, // Random price 1,000,000 - 10,000,000
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
          unit_size: 55,
          bedrooms: 2,
          bathrooms: 2,
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
          unit_size: 25,
          bedrooms: 0,
          bathrooms: 1,
          unit_price: Math.floor(Math.random() * 9000000) + 1000000,
          payment_terms: '15% DP, 85% bank',
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

  // --- AMENITIES ---
  for (const project of allProjects) {
    await prisma.amenities.createMany({
      data: [
        { project_id: project.id, name: 'Swimming Pool' },
        { project_id: project.id, name: 'Gym' },
        { project_id: project.id, name: 'Playground' },
      ],
    });
  }

  // --- ASSETS ---
  for (const unit of allUnits) {
    await prisma.assets.createMany({
      data: [
        {
          project_id: unit.project_id,
          unit_id: unit.id,
          image_link: 'https://example.com/image1.jpg',
          video_link: 'https://example.com/video1.mp4',
          document_link: 'https://example.com/brochure1.pdf',
        },
        {
          project_id: unit.project_id,
          unit_id: unit.id,
          image_link: 'https://example.com/image2.jpg',
          video_link: 'https://example.com/video2.mp4',
          document_link: 'https://example.com/brochure2.pdf',
        },
        {
          project_id: unit.project_id,
          unit_id: unit.id,
          image_link: 'https://example.com/image3.jpg',
          video_link: 'https://example.com/video3.mp4',
          document_link: 'https://example.com/brochure3.pdf',
        },
      ],
    });
  }

  await backfillProjectSlugs(prisma);
  console.log('✅ Project slugs backfilled');

  await backfillUnitSlugs(prisma);
  console.log('✅ Unit slugs backfilled');

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
