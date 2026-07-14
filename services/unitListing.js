const LISTING_TYPES = ['sale', 'rent'];

function parseOptionalPrice(value) {
  if (value === '' || value == null) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeUnitListingFields(body = {}) {
  const listingType = String(body.listing_type || 'sale').trim().toLowerCase();
  const normalizedType = LISTING_TYPES.includes(listingType) ? listingType : 'sale';

  if (normalizedType === 'sale') {
    return {
      listing_type: 'sale',
      unit_price: parseOptionalPrice(body.unit_price) ?? 0,
      monthly_rent: null,
      daily_rent: null,
      hourly_rent: null,
    };
  }

  return {
    listing_type: 'rent',
    unit_price: parseOptionalPrice(body.unit_price),
    monthly_rent: parseOptionalPrice(body.monthly_rent),
    daily_rent: parseOptionalPrice(body.daily_rent),
    hourly_rent: parseOptionalPrice(body.hourly_rent),
  };
}

function validateUnitListingFields(listingFields) {
  if (listingFields.listing_type === 'sale') {
    if (!(listingFields.unit_price > 0)) {
      return 'Sale price is required for units listed for sale.';
    }
    return null;
  }

  const hasRent = [listingFields.monthly_rent, listingFields.daily_rent, listingFields.hourly_rent]
    .some((value) => typeof value === 'number' && value > 0);

  if (!hasRent) {
    return 'Enter at least one rental rate (monthly, daily, or hourly).';
  }

  return null;
}

function pickUnitDisplayPrice(unit = {}) {
  if ((unit.listing_type || 'sale') === 'sale') {
    return unit.unit_price || null;
  }

  if (unit.monthly_rent > 0) return unit.monthly_rent;
  if (unit.daily_rent > 0) return unit.daily_rent;
  if (unit.hourly_rent > 0) return unit.hourly_rent;

  return null;
}

function collectUnitListingPrices(unit = {}) {
  if ((unit.listing_type || 'sale') === 'sale') {
    return typeof unit.unit_price === 'number' && unit.unit_price > 0 ? [unit.unit_price] : [];
  }

  return [unit.monthly_rent, unit.daily_rent, unit.hourly_rent]
    .filter((price) => typeof price === 'number' && price > 0);
}

module.exports = {
  LISTING_TYPES,
  collectUnitListingPrices,
  normalizeUnitListingFields,
  pickUnitDisplayPrice,
  validateUnitListingFields,
};
