const DEFAULT_WEBSITE_SETTINGS = {
  property_page_records_per_page: 15,
};

const MIN_PROPERTY_PAGE_SIZE = 1;
const MAX_PROPERTY_PAGE_SIZE = 100;

function parsePropertyPageSize(value) {
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed)
    || parsed < MIN_PROPERTY_PAGE_SIZE
    || parsed > MAX_PROPERTY_PAGE_SIZE
  ) {
    return null;
  }
  return parsed;
}

function sanitizeWebsiteSettingsInput(body = {}) {
  const value = parsePropertyPageSize(body.property_page_records_per_page);
  if (value === null) {
    const error = new Error(
      `Property page records per page must be a whole number between ${MIN_PROPERTY_PAGE_SIZE} and ${MAX_PROPERTY_PAGE_SIZE}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    property_page_records_per_page: value,
  };
}

function toPublicWebsiteSettings(row = null) {
  const pageSize = parsePropertyPageSize(row?.property_page_records_per_page);
  return {
    property_page_records_per_page:
      pageSize ?? DEFAULT_WEBSITE_SETTINGS.property_page_records_per_page,
    updated_at: row?.updated_at || null,
  };
}

async function getOrCreateWebsiteSettings(prisma) {
  const existing = await prisma.website_settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;

  return prisma.website_settings.create({
    data: {
      id: 1,
      ...DEFAULT_WEBSITE_SETTINGS,
    },
  });
}

module.exports = {
  DEFAULT_WEBSITE_SETTINGS,
  getOrCreateWebsiteSettings,
  sanitizeWebsiteSettingsInput,
  toPublicWebsiteSettings,
};
