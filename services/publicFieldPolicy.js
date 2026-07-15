const PUBLIC_DESCRIPTION_MAX = 160;
const { pickUnitDisplayPrice } = require('./unitListing');
const { buildUnitRef } = require('./unitSlug');

function isPrivateProject(project = {}) {
  return Boolean(project.is_private_on_website);
}

function truncateText(value, maxLen = PUBLIC_DESCRIPTION_MAX) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}…`;
}

function omitGatedPaymentFields(record = {}) {
  return {
    ...record,
    payment_terms: undefined,
    payment_terms_link: undefined,
    reservation_fee: undefined,
    is_reservation_deductible: undefined,
    monthly_dues: undefined,
    monthly_dues_per_sqm: undefined,
  };
}

function sanitizePublicProjectCore(project = {}, fields = {}) {
  const isPrivate = isPrivateProject(project);

  return {
    ...fields,
    location: undefined,
    showroom_location: undefined,
    contact_person: undefined,
    contact_person_position: undefined,
    contact_person_number: undefined,
    contact_person_email: undefined,
    loan_type: isPrivate ? undefined : fields.loan_type,
    reservation_requirements: isPrivate ? undefined : fields.reservation_requirements,
    description: isPrivate
      ? truncateText(fields.description)
      : fields.description,
    developer: isPrivate ? undefined : fields.developer,
    developer_website: isPrivate ? undefined : fields.developer_website,
    developer_notes: undefined,
  };
}

function sanitizePublicProjectListing(project = {}) {
  return sanitizePublicProjectCore(project, {
    id: project.id,
    slug: project.slug,
    project_name: project.project_name,
    is_private_on_website: project.is_private_on_website,
    developer: project.developer,
    developer_website: project.developer_website,
    city: project.city,
    description: project.description,
    status: project.status,
    amenities: project.amenities,
    images_videos_link: project.images_videos_link,
    buildingCount: project.buildingCount,
    unitCount: project.unitCount,
    wholeBuildingCount: project.wholeBuildingCount,
    unitTypes: project.unitTypes,
    buildingTypes: project.buildingTypes,
    minPrice: project.minPrice,
    maxPrice: project.maxPrice,
    image: project.image,
    logo: project.logo,
    is_featured: project.is_featured,
    featured_sort_order: project.featured_sort_order,
  });
}

function sanitizePublicProjectDetail(project = {}, detail = {}) {
  const sanitized = sanitizePublicProjectCore(project, detail);

  sanitized.buildings = (detail.buildings || []).map((building) =>
    omitGatedPaymentFields({
      id: building.id,
      slug: building.slug,
      building_name: building.building_name,
      building_type: building.building_type,
      status: building.status,
      total_available_units: building.total_available_units,
      is_whole_property_listing: building.is_whole_property_listing,
      listing_type: building.listing_type,
      sale_price: building.sale_price,
      monthly_rent: building.monthly_rent,
      daily_rent: building.daily_rent,
      hourly_rent: building.hourly_rent,
      bedrooms: building.bedrooms,
      bathrooms: building.bathrooms,
      stories: building.stories,
      total_floor_area: building.total_floor_area,
      typical_room_area: building.typical_room_area,
      number_of_units: building.number_of_units,
    }),
  );

  sanitized.units = (detail.units || []).map((unit) =>
    omitGatedPaymentFields({
      id: unit.id,
      slug: unit.slug || buildUnitRef(unit.id),
      project_slug: unit.project_slug,
      unit_type: unit.unit_type,
      unit_label: unit.unit_type,
      unit_size: unit.unit_size,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
    unit_price: unit.unit_price,
    listing_type: unit.listing_type || 'sale',
    monthly_rent: unit.monthly_rent,
    daily_rent: unit.daily_rent,
    hourly_rent: unit.hourly_rent,
    display_price: unit.display_price ?? pickUnitDisplayPrice(unit),
    building_id: unit.building_id,
      building_name: unit.building_name,
      building_status: unit.building_status,
      building_type: unit.building_type,
      image: unit.image,
    }),
  );

  sanitized.requires_contact_for = [
    'street_address',
    'unit_number',
    'floor',
    'payment_terms',
    'reservation_details',
    'direct_contact',
    'full_gallery',
  ];

  return sanitized;
}

function sanitizePublicUnitListItem(unit = {}) {
  const isPrivate = isPrivateProject({
    is_private_on_website: unit.is_private_on_website,
  });

  return omitGatedPaymentFields({
    listing_kind: unit.listing_kind,
    id: unit.id,
    slug: unit.slug,
    project_id: unit.project_id,
    unit_type: unit.unit_type,
    unit_label: unit.unit_type,
    unit_size: unit.unit_size,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    unit_price: unit.unit_price,
    listing_type: unit.listing_type || 'sale',
    monthly_rent: unit.monthly_rent,
    daily_rent: unit.daily_rent,
    hourly_rent: unit.hourly_rent,
    display_price: unit.display_price ?? unit.unit_price,
    building_name: unit.building_name,
    building_status: unit.building_status,
    project_name: unit.project_name,
    is_private_on_website: unit.is_private_on_website,
    project_slug: unit.project_slug,
    project_city: unit.project_city,
    project_status: unit.project_status,
    image: unit.image,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    developer: isPrivate ? undefined : unit.developer,
  });
}

function sanitizePublicUnitDetail(unit = {}, detail = {}) {
  const isPrivate = isPrivateProject({
    is_private_on_website: detail.is_private_on_website,
  });

  const assetImages = Array.isArray(detail.asset_images) ? detail.asset_images : [];

  return {
    ...omitGatedPaymentFields({
      id: detail.id,
      slug: detail.slug,
      project_id: detail.project_id,
      building_id: detail.building_id,
      unit_type: detail.unit_type,
      unit_label: detail.unit_type,
      unit_size: detail.unit_size,
      bedrooms: detail.bedrooms,
      bathrooms: detail.bathrooms,
      unit_price: detail.unit_price,
      listing_type: detail.listing_type || 'sale',
      monthly_rent: detail.monthly_rent,
      daily_rent: detail.daily_rent,
      hourly_rent: detail.hourly_rent,
      display_price: detail.display_price ?? detail.unit_price,
      is_pet_allowed: detail.is_pet_allowed,
      allowed_pet_size: detail.allowed_pet_size,
      is_allowed_smoking: detail.is_allowed_smoking,
      images_videos_link: detail.images_videos_link || null,
      asset_images: assetImages,
      building_name: detail.building_name,
      building_type: detail.building_type,
      building_status: detail.building_status,
      project_name: detail.project_name,
      is_private_on_website: detail.is_private_on_website,
      project_slug: detail.project_slug,
      project_developer: isPrivate ? undefined : detail.project_developer,
      project_city: detail.project_city,
      project_status: detail.project_status,
      amenities: detail.amenities,
      image: detail.image,
      logo: detail.logo,
      requires_contact_for: [
        'room_number',
        'floor',
        'street_address',
        'payment_terms',
        'full_gallery',
        'direct_contact',
      ],
    }),
    reservation_fee: detail.reservation_fee,
    is_reservation_deductible: detail.is_reservation_deductible,
  };
}

function sanitizePublicWholeBuilding(building = {}, formatted = {}) {
  const isPrivate = isPrivateProject({
    is_private_on_website: formatted.is_private_on_website,
  });

  return {
    ...omitGatedPaymentFields({
      ...formatted,
      project_location: undefined,
      project_developer: isPrivate ? undefined : formatted.project_developer,
      lot_area: undefined,
      payment_terms: undefined,
      payment_terms_link: undefined,
      monthly_dues: undefined,
      monthly_dues_per_sqm: undefined,
      images_videos_link: formatted.images_videos_link || null,
      requires_contact_for: [
        'street_address',
        'payment_terms',
        'full_gallery',
        'direct_contact',
      ],
    }),
    reservation_fee: formatted.reservation_fee,
    is_reservation_deductible: formatted.is_reservation_deductible,
  };
}

module.exports = {
  PUBLIC_DESCRIPTION_MAX,
  isPrivateProject,
  sanitizePublicProjectListing,
  sanitizePublicProjectDetail,
  sanitizePublicUnitListItem,
  sanitizePublicUnitDetail,
  sanitizePublicWholeBuilding,
  truncateText,
};
