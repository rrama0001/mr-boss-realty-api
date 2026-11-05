const { prisma } = require('../prisma/prismaClient');
const { isShareableMediaUrl } = require('../services/aiPropertySnapshot');
const { isNumericId } = require('../services/projectSlug');
const { projectMatchesUrlSegments } = require('../services/projectPublicUrl');
const { buildUnitRef, parseLegacyUnitRef, resolveUnitIdFromRef } = require('../services/unitSlug');
const { buildPublicProjectNameFields } = require('../services/projectPublicDisplay');
const { formatPublicWholeBuilding } = require('../services/buildingWholeListing');
const {
  sanitizePublicUnitDetail,
  sanitizePublicUnitListItem,
  sanitizePublicWholeBuilding,
} = require('../services/publicFieldPolicy');
const { pickProjectLogo } = require('../services/projectLogo');
const { pickUnitImage } = require('../services/unitAssets');
const { pickUnitDisplayPrice } = require('../services/unitListing');
const { normalizeStoredUploadUrl } = require('../services/uploadUrls');
const { cityToSlug } = require('../services/projectPublicUrl');

const unitInclude = {
  projects: {
    select: {
      id: true,
      slug: true,
      project_name: true,
      city: true,
      location: true,
      developer: true,
      status: true,
      is_private_on_website: true,
      amenities: true,
      images_videos_link: true,
      cover_image_url: true,
      assets: {
        select: { image_link: true, unit_id: true, updated_at: true },
      },
    },
  },
  buildings: {
    select: {
      building_name: true,
      building_type: true,
      status: true,
    },
  },
  assets: {
    select: { image_link: true },
  },
};

const wholeBuildingProjectSelect = {
  id: true,
  slug: true,
  project_name: true,
  city: true,
  location: true,
  developer: true,
  status: true,
  is_private_on_website: true,
  amenities: true,
  images_videos_link: true,
  cover_image_url: true,
  assets: {
    select: { image_link: true, unit_id: true, updated_at: true },
  },
};

function pickProjectImageFromRecord(project = {}) {
  if (isShareableMediaUrl(project.cover_image_url)) {
    return normalizeStoredUploadUrl(project.cover_image_url.trim());
  }

  if (isShareableMediaUrl(project.images_videos_link)) {
    return normalizeStoredUploadUrl(project.images_videos_link.trim());
  }

  const assetImage = project.assets?.find(
    (asset) => !asset.unit_id && isShareableMediaUrl(asset.image_link)
  )?.image_link;

  if (assetImage) {
    return normalizeStoredUploadUrl(assetImage.trim());
  }

  return null;
}

async function findProjectByPublicParam(param) {
  const value = String(param || '').trim();
  if (!value) return null;

  if (isNumericId(value)) {
    return prisma.projects.findUnique({
      where: { id: parseInt(value, 10) },
      select: { id: true, slug: true },
    });
  }

  return prisma.projects.findUnique({
    where: { slug: value },
    select: { id: true, slug: true },
  });
}

async function findUnitByLegacyParam(param) {
  const value = String(param || '').trim();
  if (!value) return null;

  const legacyId = parseLegacyUnitRef(value);
  if (legacyId != null) {
    return prisma.units.findUnique({
      where: { id: legacyId },
      include: unitInclude,
    });
  }

  return prisma.units.findFirst({
    where: { slug: value.toLowerCase() },
    include: unitInclude,
  });
}

function collectUnitAssetImages(unit) {
  return (unit.assets || [])
    .map((asset) => asset.image_link)
    .filter(isShareableMediaUrl)
    .map((url) => normalizeStoredUploadUrl(url.trim()));
}

function formatPublicUnitListItem(unit) {
  const publicNameFields = buildPublicProjectNameFields(unit.projects || {});

  return {
    listing_kind: 'unit',
    id: unit.id,
    slug: unit.slug || buildUnitRef(unit.id),
    project_id: unit.project_id,
    room_number: unit.room_number,
    unit_type: unit.unit_type,
    unit_size: unit.unit_size,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    floor: unit.floor,
    unit_price: unit.unit_price,
    listing_type: unit.listing_type || 'sale',
    monthly_rent: unit.monthly_rent,
    daily_rent: unit.daily_rent,
    hourly_rent: unit.hourly_rent,
    display_price: pickUnitDisplayPrice(unit),
    payment_terms: unit.payment_terms,
    building_name: unit.buildings?.building_name || null,
    building_status: unit.buildings?.status || null,
    ...publicNameFields,
    developer: unit.projects?.developer || null,
    project_slug: unit.projects?.slug || null,
    project_city: unit.projects?.city || null,
    project_location: unit.projects?.location || null,
    project_status: unit.projects?.status || null,
    image: pickUnitImage(unit),
    created_at: unit.created_at,
    updated_at: unit.updated_at,
  };
}

function formatPublicWholeBuildingListItem(building) {
  const project = building.projects || {};
  const publicNameFields = buildPublicProjectNameFields(project);
  const formatted = formatPublicWholeBuilding(building, {
    ...project,
    image: pickProjectImageFromRecord(project),
  });

  return {
    listing_kind: 'whole_building',
    ...formatted,
    ...publicNameFields,
    building_status: building.status || null,
    image: formatted.image || pickProjectImageFromRecord(project),
    created_at: building.created_at,
    updated_at: building.updated_at,
  };
}

function formatPublicUnitDetail(unit) {
  const publicNameFields = buildPublicProjectNameFields(unit.projects || {});

  return {
    id: unit.id,
    slug: unit.slug || buildUnitRef(unit.id),
    project_id: unit.project_id,
    building_id: unit.building_id,
    room_number: unit.room_number,
    unit_type: unit.unit_type,
    unit_size: unit.unit_size,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    floor: unit.floor,
    unit_price: unit.unit_price,
    listing_type: unit.listing_type || 'sale',
    monthly_rent: unit.monthly_rent,
    daily_rent: unit.daily_rent,
    hourly_rent: unit.hourly_rent,
    display_price: pickUnitDisplayPrice(unit),
    payment_terms: unit.payment_terms,
    payment_terms_link: unit.payment_terms_link,
    reservation_fee: unit.reservation_fee,
    is_reservation_deductible: unit.is_reservation_deductible,
    monthly_dues: unit.monthly_dues,
    monthly_dues_per_sqm: unit.monthly_dues_per_sqm,
    is_pet_allowed: unit.is_pet_allowed,
    allowed_pet_size: unit.allowed_pet_size,
    is_allowed_smoking: unit.is_allowed_smoking,
    images_videos_link: unit.images_videos_link || null,
    asset_images: collectUnitAssetImages(unit),
    building_name: unit.buildings?.building_name || null,
    building_type: unit.buildings?.building_type || null,
    building_status: unit.buildings?.status || null,
    ...publicNameFields,
    project_slug: unit.projects?.slug || null,
    project_developer: unit.projects?.developer || null,
    project_city: unit.projects?.city || null,
    project_location: unit.projects?.location || null,
    project_status: unit.projects?.status || null,
    amenities: unit.projects?.amenities || null,
    image: pickUnitImage(unit),
    logo: pickProjectLogo(unit.projects || {}),
  };
}

const UNIT_TYPE_ORDER = [
  'Studio',
  'Standard Room',
  '1 Bedroom',
  '2 Bedroom',
  '3 Bedroom',
  'Loft',
  'Penthouse',
  'Hotel Room',
  'Deluxe Room',
  'Suite',
  'Executive Suite',
  'Presidential Suite',
  'Retail Space',
  'Office Space',
  'Warehouse',
  'Storage Unit',
  'Showroom',
  'Restaurant Space',
  'Kiosk',
  'Function Room',
  'Conference Room',
  'Meeting Room',
  'Event Hall',
  'Parking Slot',
  'Motorcycle Parking',
  'Storage Locker',
];

const unitListInclude = {
  projects: {
    select: {
      id: true,
      slug: true,
      project_name: true,
      city: true,
      location: true,
      developer: true,
      status: true,
      is_private_on_website: true,
    },
  },
  buildings: {
    select: {
      building_name: true,
      building_type: true,
      status: true,
      is_whole_property_listing: true,
    },
  },
  assets: {
    select: { image_link: true },
  },
};

function parseQueryList(value) {
  if (value == null || value === '') return [];
  const source = Array.isArray(value) ? value : String(value).split('|');
  return source.map((item) => String(item).trim()).filter(Boolean);
}

function parseQueryNumbers(value) {
  return parseQueryList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textMatchesSearch(haystack, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const text = normalizeSearchText(haystack);
  if (!text) return false;

  return normalizedQuery.split(' ').filter(Boolean).every((token) => text.includes(token));
}

function listingSortTime(record) {
  return new Date(record.updated_at || record.created_at || 0).getTime();
}

function buildListingSearchText(parts) {
  return parts.filter(Boolean).join(' ');
}

function publicListingUnitWhere(listingTypeFilter) {
  return {
    // Soft-delete does not filter to-one project relations, so exclude units
    // whose parent project was deleted (AI inventory already skips those).
    projects: { deleted_at: null },
    buildings: {
      is_whole_property_listing: false,
      deleted_at: null,
    },
    ...(listingTypeFilter ? { listing_type: listingTypeFilter } : {}),
  };
}

function publicListingWholeBuildingWhere(listingTypeFilter) {
  return {
    is_whole_property_listing: true,
    deleted_at: null,
    projects: { deleted_at: null },
    ...(listingTypeFilter ? { listing_type: listingTypeFilter } : {}),
  };
}

async function loadListingIndex(listingTypeFilter) {
  const unitWhere = publicListingUnitWhere(listingTypeFilter);
  const buildingWhere = publicListingWholeBuildingWhere(listingTypeFilter);

  const [units, wholeBuildings] = await Promise.all([
    prisma.units.findMany({
      where: unitWhere,
      select: {
        id: true,
        slug: true,
        unit_type: true,
        bedrooms: true,
        bathrooms: true,
        listing_type: true,
        created_at: true,
        updated_at: true,
        projects: {
          select: {
            project_name: true,
            city: true,
            location: true,
            developer: true,
            slug: true,
          },
        },
        buildings: {
          select: { building_name: true, building_type: true },
        },
      },
    }),
    prisma.buildings.findMany({
      where: buildingWhere,
      select: {
        id: true,
        building_name: true,
        building_type: true,
        listing_type: true,
        bedrooms: true,
        bathrooms: true,
        created_at: true,
        updated_at: true,
        projects: {
          select: {
            project_name: true,
            city: true,
            location: true,
            developer: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  const unitItems = units.map((unit) => ({
    kind: 'unit',
    id: unit.id,
    sortAt: listingSortTime(unit),
    unit_type: unit.unit_type,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    project_city: unit.projects?.city || '',
    searchText: buildListingSearchText([
      unit.unit_type,
      unit.slug,
      unit.listing_type,
      unit.buildings?.building_name,
      unit.buildings?.building_type,
      unit.projects?.project_name,
      unit.projects?.city,
      unit.projects?.location,
      unit.projects?.developer,
      unit.projects?.slug,
      unit.bedrooms != null ? `${unit.bedrooms} br` : '',
      unit.bedrooms != null ? `${unit.bedrooms} bedroom` : '',
      unit.bathrooms != null ? `${unit.bathrooms} ba` : '',
      unit.bathrooms != null ? `${unit.bathrooms} bathroom` : '',
    ]),
  }));

  const buildingItems = wholeBuildings.map((building) => ({
    kind: 'whole_building',
    id: building.id,
    sortAt: listingSortTime(building),
    unit_type: null,
    bedrooms: building.bedrooms,
    bathrooms: building.bathrooms,
    project_city: building.projects?.city || '',
    searchText: buildListingSearchText([
      building.building_name,
      building.building_type,
      building.listing_type,
      building.projects?.project_name,
      building.projects?.city,
      building.projects?.location,
      building.projects?.developer,
      building.projects?.slug,
    ]),
  }));

  return [...unitItems, ...buildingItems].sort((a, b) => b.sortAt - a.sortAt);
}

function filterListingIndex(listing, query) {
  const search = String(query.q || '').trim();
  const cities = parseQueryList(query.cities);
  const citySlug = String(query.city_slug || '').trim().toLowerCase();
  const unitTypes = parseQueryList(query.unit_types);
  const bedrooms = parseQueryNumbers(query.bedrooms);
  const bathrooms = parseQueryNumbers(query.bathrooms);

  return listing.filter((item) => {
    const city = String(item.project_city || '').trim();
    if (citySlug) {
      if (cityToSlug(city) !== citySlug) return false;
    } else if (cities.length && !cities.includes(city)) {
      return false;
    }

    const isWholeBuilding = item.kind === 'whole_building';
    if (!isWholeBuilding && unitTypes.length && !unitTypes.includes(item.unit_type)) {
      return false;
    }
    if (!isWholeBuilding && bedrooms.length) {
      if (item.bedrooms == null || !bedrooms.some((value) => Number(item.bedrooms) === value)) {
        return false;
      }
    }
    if (!isWholeBuilding && bathrooms.length) {
      if (item.bathrooms == null || !bathrooms.some((value) => Number(item.bathrooms) === value)) {
        return false;
      }
    }

    return textMatchesSearch(item.searchText, search);
  });
}

function buildListingFacets(listing) {
  const cities = new Map();
  const unitTypes = new Map();
  const bedrooms = new Map();
  const bathrooms = new Map();

  listing.forEach((item) => {
    const city = String(item.project_city || '').trim();
    if (city) cities.set(city, (cities.get(city) || 0) + 1);

    if (item.kind === 'whole_building') return;

    if (item.unit_type) unitTypes.set(item.unit_type, (unitTypes.get(item.unit_type) || 0) + 1);
    if (item.bedrooms != null) bedrooms.set(item.bedrooms, (bedrooms.get(item.bedrooms) || 0) + 1);
    if (item.bathrooms != null) bathrooms.set(item.bathrooms, (bathrooms.get(item.bathrooms) || 0) + 1);
  });

  const typeOrder = new Map(UNIT_TYPE_ORDER.map((name, index) => [name, index]));

  return {
    cities: [...cities.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count })),
    unit_types: [...unitTypes.entries()]
      .sort((a, b) => {
        const aIndex = typeOrder.has(a[0]) ? typeOrder.get(a[0]) : Number.MAX_SAFE_INTEGER;
        const bIndex = typeOrder.has(b[0]) ? typeOrder.get(b[0]) : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a[0].localeCompare(b[0]);
      })
      .map(([name, count]) => ({ name, count })),
    bedrooms: [...bedrooms.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([value, count]) => ({ value: Number(value), count })),
    bathrooms: [...bathrooms.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([value, count]) => ({ value: Number(value), count })),
  };
}

async function hydrateListingPage(pageItems) {
  const unitIds = pageItems.filter((item) => item.kind === 'unit').map((item) => item.id);
  const buildingIds = pageItems.filter((item) => item.kind === 'whole_building').map((item) => item.id);

  const [units, wholeBuildings] = await Promise.all([
    unitIds.length
      ? prisma.units.findMany({ where: { id: { in: unitIds } }, include: unitListInclude })
      : [],
    buildingIds.length
      ? prisma.buildings.findMany({
        where: { id: { in: buildingIds } },
        include: { projects: { select: wholeBuildingProjectSelect } },
      })
      : [],
  ]);

  const unitsById = new Map(units.map((unit) => [
    unit.id,
    sanitizePublicUnitListItem(formatPublicUnitListItem(unit)),
  ]));
  const buildingsById = new Map(wholeBuildings.map((building) => [
    building.id,
    sanitizePublicWholeBuilding(
      building.projects || {},
      formatPublicWholeBuildingListItem(building),
    ),
  ]));

  return pageItems
    .map((item) => (item.kind === 'unit' ? unitsById.get(item.id) : buildingsById.get(item.id)))
    .filter(Boolean);
}

async function loadFormattedPublicListing(listingTypeFilter) {
  const units = await prisma.units.findMany({
    where: publicListingUnitWhere(listingTypeFilter),
    orderBy: { created_at: 'desc' },
    include: unitListInclude,
  });

  const wholeBuildings = await prisma.buildings.findMany({
    where: publicListingWholeBuildingWhere(listingTypeFilter),
    orderBy: { updated_at: 'desc' },
    include: { projects: { select: wholeBuildingProjectSelect } },
  });

  const unitItems = units.map((unit) => sanitizePublicUnitListItem(formatPublicUnitListItem(unit)));
  const wholeBuildingItems = wholeBuildings.map((building) => sanitizePublicWholeBuilding(
    building.projects || {},
    formatPublicWholeBuildingListItem(building),
  ));

  return [...unitItems, ...wholeBuildingItems].sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

exports.getPublicListing = async (req, res) => {
  try {
    const limitParam = req.query.limit;
    const listingTypeFilter = String(req.query.listing_type || '').trim().toLowerCase();
    const paginate = req.query.page != null && req.query.page !== '';

    if (paginate) {
      const perPageRaw = parseInt(req.query.per_page, 10);
      const perPage = Number.isNaN(perPageRaw) ? 15 : Math.min(Math.max(perPageRaw, 1), 100);
      const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const index = await loadListingIndex(listingTypeFilter);
      const facets = buildListingFacets(index);
      const filtered = filterListingIndex(index, req.query);
      const total = filtered.length;
      const lastPage = Math.max(1, Math.ceil(total / perPage) || 1);
      const currentPage = Math.min(requestedPage, lastPage);
      const start = (currentPage - 1) * perPage;
      const data = await hydrateListingPage(filtered.slice(start, start + perPage));

      return res.json({
        data,
        meta: {
          total,
          unfiltered_total: index.length,
          per_page: perPage,
          current_page: currentPage,
          last_page: lastPage,
          facets,
        },
      });
    }

    let take;

    if (limitParam === 'all') {
      take = undefined;
    } else {
      const parsedLimit = parseInt(limitParam, 10);
      take = Number.isNaN(parsedLimit) ? 6 : Math.min(Math.max(parsedLimit, 1), 500);
    }

    const listing = await loadFormattedPublicListing(listingTypeFilter);
    const limitedListing = take != null ? listing.slice(0, take) : listing;

    res.json(limitedListing);
  } catch (err) {
    console.error('Error fetching public unit listing:', err);
    res.status(500).json({ error: err.message });
  }
};

async function fetchPublicUnitDetailBySegments(citySlug, projectSlug, unitRef) {
  const unitId = await resolveUnitIdFromRef(prisma, unitRef);
  if (unitId == null) {
    return null;
  }

  const unit = await prisma.units.findUnique({
    where: { id: unitId },
    include: unitInclude,
  });

  if (!unit?.projects) {
    return null;
  }

  if (!projectMatchesUrlSegments(unit.projects, citySlug, projectSlug)) {
    return null;
  }

  return sanitizePublicUnitDetail(unit, formatPublicUnitDetail(unit));
}

exports.fetchPublicUnitDetailBySegments = fetchPublicUnitDetailBySegments;

exports.getPublicDetailBySegments = async (req, res) => {
  try {
    const payload = await fetchPublicUnitDetailBySegments(
      req.params.citySlug,
      req.params.projectSlug,
      req.params.unitRef,
    );

    if (!payload) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    res.json(payload);
  } catch (err) {
    console.error('Error fetching public unit detail by segments:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicDetail = async (req, res) => {
  try {
    const unitId = await resolveUnitIdFromRef(prisma, req.params.unitRef);
    if (unitId == null) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    const project = await findProjectByPublicParam(req.params.projectSlug);
    if (project) {
      const unit = await prisma.units.findFirst({
        where: {
          id: unitId,
          project_id: project.id,
        },
        include: unitInclude,
      });

      if (unit) {
        return res.json(sanitizePublicUnitDetail(unit, formatPublicUnitDetail(unit)));
      }
    }

    const unitById = await prisma.units.findUnique({
      where: { id: unitId },
      include: unitInclude,
    });

    if (!unitById) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    res.json(sanitizePublicUnitDetail(unitById, formatPublicUnitDetail(unitById)));
  } catch (err) {
    console.error('Error fetching public unit detail:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicDetailLegacy = async (req, res) => {
  try {
    const unit = await findUnitByLegacyParam(req.params.slug);

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    res.json(sanitizePublicUnitDetail(unit, formatPublicUnitDetail(unit)));
  } catch (err) {
    console.error('Error fetching public unit detail:', err);
    res.status(500).json({ error: err.message });
  }
};
