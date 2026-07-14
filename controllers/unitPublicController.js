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
  assets: {
    select: { image_link: true, unit_id: true, updated_at: true },
  },
};

function pickProjectImageFromRecord(project = {}) {
  if (isShareableMediaUrl(project.images_videos_link)) {
    return project.images_videos_link.trim();
  }

  const assetImage = project.assets?.find(
    (asset) => !asset.unit_id && isShareableMediaUrl(asset.image_link)
  )?.image_link;

  if (assetImage) {
    return assetImage.trim();
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
    .map((url) => url.trim());
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

exports.getPublicListing = async (req, res) => {
  try {
    const limitParam = req.query.limit;
    const listingTypeFilter = String(req.query.listing_type || '').trim().toLowerCase();
    let take;

    if (limitParam === 'all') {
      take = undefined;
    } else {
      const parsedLimit = parseInt(limitParam, 10);
      take = Number.isNaN(parsedLimit) ? 6 : Math.min(Math.max(parsedLimit, 1), 500);
    }

    const units = await prisma.units.findMany({
      orderBy: { created_at: 'desc' },
      include: {
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
            status: true,
            is_whole_property_listing: true,
          },
        },
        assets: {
          select: { image_link: true },
        },
      },
      where: {
        buildings: {
          is_whole_property_listing: false,
        },
      },
    });

    const wholeBuildings = await prisma.buildings.findMany({
      where: {
        is_whole_property_listing: true,
        ...(listingTypeFilter ? { listing_type: listingTypeFilter } : {}),
      },
      orderBy: { updated_at: 'desc' },
      include: {
        projects: {
          select: wholeBuildingProjectSelect,
        },
      },
    });

    const unitItems = units
      .filter((unit) => {
        if (!listingTypeFilter) return true;
        const type = unit.listing_type || 'sale';
        return type === listingTypeFilter;
      })
      .map((unit) => sanitizePublicUnitListItem(formatPublicUnitListItem(unit)));

    const wholeBuildingItems = wholeBuildings.map((building) =>
      sanitizePublicWholeBuilding(
        building.projects || {},
        formatPublicWholeBuildingListItem(building),
      ),
    );

    const listing = [...unitItems, ...wholeBuildingItems]
      .sort((a, b) => {
        const aTime = a.updated_at || a.created_at || 0;
        const bTime = b.updated_at || b.created_at || 0;
        return new Date(bTime) - new Date(aTime);
      });

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
