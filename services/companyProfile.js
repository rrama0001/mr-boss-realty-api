const DEFAULT_COMPANY_PROFILE = {
  company_name: 'Mr. Boss Realty',
  tagline: 'The smarter way to find your next property—anywhere, anytime.',
  email: 'hello@mrbossrealty.com',
  phone: '+63 917 000 0000',
  whatsapp: null,
  address: 'Cebu City, Philippines',
  city: 'Cebu City',
  business_hours: '8:00 AM – 6:00 PM, Mon–Sat',
  facebook_url: null,
  messenger_url: null,
  instagram_url: null,
  website_url: 'https://www.mrbossrealty.com',
  maps_url: null,
  legal_name: null,
  privacy_email: null,
};

const EDITABLE_FIELDS = [
  'company_name',
  'tagline',
  'email',
  'phone',
  'whatsapp',
  'address',
  'city',
  'business_hours',
  'facebook_url',
  'messenger_url',
  'instagram_url',
  'website_url',
  'maps_url',
  'legal_name',
  'privacy_email',
];

function optionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function sanitizeCompanyProfileInput(body = {}) {
  const data = {};

  for (const field of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    data[field] = optionalString(body[field]);
  }

  return data;
}

function toPublicCompanyProfile(row = null) {
  const source = row || DEFAULT_COMPANY_PROFILE;

  return {
    company_name: source.company_name || DEFAULT_COMPANY_PROFILE.company_name,
    tagline: source.tagline || DEFAULT_COMPANY_PROFILE.tagline,
    email: source.email || DEFAULT_COMPANY_PROFILE.email,
    phone: source.phone || DEFAULT_COMPANY_PROFILE.phone,
    whatsapp: source.whatsapp || null,
    address: source.address || DEFAULT_COMPANY_PROFILE.address,
    city: source.city || DEFAULT_COMPANY_PROFILE.city,
    business_hours: source.business_hours || DEFAULT_COMPANY_PROFILE.business_hours,
    facebook_url: source.facebook_url || null,
    messenger_url: source.messenger_url || null,
    instagram_url: source.instagram_url || null,
    website_url: source.website_url || DEFAULT_COMPANY_PROFILE.website_url,
    maps_url: source.maps_url || null,
    legal_name: source.legal_name || null,
    privacy_email: source.privacy_email || null,
    updated_at: source.updated_at || null,
  };
}

async function getOrCreateCompanyProfile(prisma) {
  const existing = await prisma.company_profile.findUnique({ where: { id: 1 } });
  if (existing) return existing;

  return prisma.company_profile.create({
    data: {
      id: 1,
      ...DEFAULT_COMPANY_PROFILE,
    },
  });
}

module.exports = {
  DEFAULT_COMPANY_PROFILE,
  EDITABLE_FIELDS,
  getOrCreateCompanyProfile,
  sanitizeCompanyProfileInput,
  toPublicCompanyProfile,
};
