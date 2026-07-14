const LISTING_TYPES = ['sale', 'rent'];
const { buildBuildingRef } = require('./buildingSlug');

function parseOptionalPrice(value) {
  if (value === '' || value == null) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function parseOptionalInt(value) {
  if (value === '' || value == null) return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function parseOptionalString(value) {
  if (value === '' || value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function parseOptionalBoolean(value) {
  if (value === '' || value == null) return null;
  return Boolean(value);
}

function normalizeWholeListingFields(body = {}) {
  const isWhole = Boolean(body.is_whole_property_listing);
  const listingType = isWhole ? String(body.listing_type || '').trim().toLowerCase() : null;

  if (!isWhole) {
    return {
      is_whole_property_listing: false,
      listing_type: null,
      sale_price: null,
      monthly_rent: null,
      daily_rent: null,
      hourly_rent: null,
    };
  }

  const salePrice = parseOptionalPrice(body.sale_price);
  const monthlyRent = parseOptionalPrice(body.monthly_rent);
  const dailyRent = parseOptionalPrice(body.daily_rent);
  const hourlyRent = parseOptionalPrice(body.hourly_rent);

  return {
    is_whole_property_listing: true,
    listing_type: listingType || null,
    sale_price: listingType === 'sale' ? salePrice : null,
    monthly_rent: listingType === 'rent' ? monthlyRent : null,
    daily_rent: listingType === 'rent' ? dailyRent : null,
    hourly_rent: listingType === 'rent' ? hourlyRent : null,
  };
}

function normalizeWholeListingDetails(body = {}, isWhole = false) {
  if (!isWhole) {
    return {
      bedrooms: null,
      bathrooms: null,
      stories: null,
      total_floor_area: null,
      typical_room_area: null,
      lot_area: null,
      payment_terms: null,
      payment_terms_link: null,
      reservation_fee: null,
      is_reservation_deductible: null,
      monthly_dues: null,
      monthly_dues_per_sqm: null,
      is_pet_allowed: null,
      allowed_pet_size: null,
      is_allowed_smoking: null,
      images_videos_link: null,
    };
  }

  return {
    bedrooms: parseOptionalInt(body.bedrooms),
    bathrooms: parseOptionalInt(body.bathrooms),
    stories: parseOptionalInt(body.stories),
    total_floor_area: parseOptionalString(body.total_floor_area),
    typical_room_area: parseOptionalString(body.typical_room_area),
    lot_area: parseOptionalString(body.lot_area),
    payment_terms: parseOptionalString(body.payment_terms),
    payment_terms_link: parseOptionalString(body.payment_terms_link),
    reservation_fee: parseOptionalPrice(body.reservation_fee),
    is_reservation_deductible: parseOptionalBoolean(body.is_reservation_deductible),
    monthly_dues: parseOptionalPrice(body.monthly_dues),
    monthly_dues_per_sqm: parseOptionalPrice(body.monthly_dues_per_sqm),
    is_pet_allowed: parseOptionalBoolean(body.is_pet_allowed),
    allowed_pet_size: parseOptionalString(body.allowed_pet_size),
    is_allowed_smoking: parseOptionalBoolean(body.is_allowed_smoking),
    images_videos_link: parseOptionalString(body.images_videos_link),
  };
}

function validateWholeListingFields(wholeListingFields) {
  if (!wholeListingFields.is_whole_property_listing) {
    return null;
  }

  if (!LISTING_TYPES.includes(wholeListingFields.listing_type)) {
    return 'Listing type is required. Choose Sale or Rent.';
  }

  if (wholeListingFields.listing_type === 'sale') {
    if (!(wholeListingFields.sale_price > 0)) {
      return 'Price is required for whole-property sale listings.';
    }
    return null;
  }

  const hasRent = [wholeListingFields.monthly_rent, wholeListingFields.daily_rent, wholeListingFields.hourly_rent]
    .some((value) => typeof value === 'number' && value > 0);

  if (!hasRent) {
    return 'Enter at least one rental rate (monthly, daily, or hourly).';
  }

  return null;
}

function collectWholeListingPrices(building = {}) {
  if (!building.is_whole_property_listing) return [];

  if (building.listing_type === 'sale' && typeof building.sale_price === 'number' && building.sale_price > 0) {
    return [building.sale_price];
  }

  if (building.listing_type === 'rent') {
    return [building.monthly_rent, building.daily_rent, building.hourly_rent]
      .filter((price) => typeof price === 'number' && price > 0);
  }

  return [];
}

function pickWholeListingDisplayPrice(building = {}) {
  if (building.listing_type === 'sale') {
    return building.sale_price || null;
  }

  if (building.monthly_rent > 0) return building.monthly_rent;
  if (building.daily_rent > 0) return building.daily_rent;
  if (building.hourly_rent > 0) return building.hourly_rent;

  return null;
}

function formatPublicWholeBuilding(building, project = {}) {
  return {
    id: building.id,
    building_name: building.building_name,
    building_type: building.building_type,
    status: building.status,
    is_whole_property_listing: true,
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
    lot_area: building.lot_area,
    number_of_units: building.number_of_units,
    total_available_units: building.total_available_units,
    payment_terms: building.payment_terms,
    payment_terms_link: building.payment_terms_link,
    reservation_fee: building.reservation_fee,
    is_reservation_deductible: building.is_reservation_deductible,
    monthly_dues: building.monthly_dues,
    monthly_dues_per_sqm: building.monthly_dues_per_sqm,
    is_pet_allowed: building.is_pet_allowed,
    allowed_pet_size: building.allowed_pet_size,
    is_allowed_smoking: building.is_allowed_smoking,
    images_videos_link: building.images_videos_link,
    slug: building.slug || buildBuildingRef(building.id),
    display_price: pickWholeListingDisplayPrice(building),
    project_id: project.id ?? building.project_id ?? null,
    project_slug: project.slug ?? null,
    project_name: project.project_name ?? null,
    project_developer: project.developer ?? null,
    is_private_on_website: Boolean(project.is_private_on_website),
    project_city: project.city ?? null,
    project_location: project.location ?? null,
    project_status: project.status ?? null,
    amenities: project.amenities ?? null,
    image: project.image ?? null,
  };
}

module.exports = {
  LISTING_TYPES,
  parseOptionalInt,
  parseOptionalString,
  parseOptionalBoolean,
  parseOptionalPrice,
  normalizeWholeListingFields,
  normalizeWholeListingDetails,
  validateWholeListingFields,
  collectWholeListingPrices,
  pickWholeListingDisplayPrice,
  formatPublicWholeBuilding,
};
