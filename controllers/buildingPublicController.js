const { prisma } = require('../prisma/prismaClient');
const { isShareableMediaUrl } = require('../services/aiPropertySnapshot');
const { isNumericId } = require('../services/projectSlug');
const { projectMatchesUrlSegments } = require('../services/projectPublicUrl');
const { buildPublicProjectNameFields } = require('../services/projectPublicDisplay');
const { formatPublicWholeBuilding } = require('../services/buildingWholeListing');
const { resolveBuildingIdFromRef } = require('../services/buildingSlug');
const { sanitizePublicWholeBuilding } = require('../services/publicFieldPolicy');
const { pickProjectLogo } = require('../services/projectLogo');
const { normalizeStoredUploadUrl } = require('../services/uploadUrls');
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

function pickProjectImageFromRecord(project = {}) {
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

function pickWholeBuildingImage(building = {}, project = {}) {
  if (isShareableMediaUrl(building.images_videos_link)) {
    return normalizeStoredUploadUrl(building.images_videos_link.trim());
  }

  return pickProjectImageFromRecord(project);
}

function formatPublicBuildingDetail(building) {
  const project = building.projects || {};
  const publicNameFields = buildPublicProjectNameFields(project);
  const formatted = formatPublicWholeBuilding(building, {
    ...project,
    image: pickProjectImageFromRecord(project),
  });

  return {
    ...formatted,
    ...publicNameFields,
    building_status: building.status || null,
    image: pickWholeBuildingImage(building, project) || formatted.image || null,
    logo: pickProjectLogo(project),
    freebies: building.freebies || null,
    total_parking: building.total_parking ?? null,
    total_available_parking: building.total_available_parking ?? null,
  };
}

async function fetchPublicBuildingDetailBySegments(citySlug, projectSlug, buildingRef) {
  const buildingId = await resolveBuildingIdFromRef(prisma, buildingRef);
  if (buildingId == null) {
    return null;
  }

  const building = await prisma.buildings.findFirst({
    where: {
      id: buildingId,
      is_whole_property_listing: true,
    },
    include: {
      projects: {
        select: wholeBuildingProjectSelect,
      },
    },
  });

  if (!building?.projects) {
    return null;
  }

  if (!projectMatchesUrlSegments(building.projects, citySlug, projectSlug)) {
    return null;
  }

  return sanitizePublicWholeBuilding(building.projects || {}, formatPublicBuildingDetail(building));
}

exports.fetchPublicBuildingDetailBySegments = fetchPublicBuildingDetailBySegments;

exports.getPublicDetailBySegments = async (req, res) => {
  try {
    const payload = await fetchPublicBuildingDetailBySegments(
      req.params.citySlug,
      req.params.projectSlug,
      req.params.buildingRef,
    );

    if (!payload) {
      return res.status(404).json({ error: 'Building not found.' });
    }

    res.json(payload);
  } catch (err) {
    console.error('Error fetching public building detail by segments:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicDetail = async (req, res) => {
  try {
    const buildingId = await resolveBuildingIdFromRef(prisma, req.params.buildingRef);
    if (buildingId == null) {
      return res.status(404).json({ error: 'Building not found.' });
    }

    const project = await findProjectByPublicParam(req.params.projectSlug);
    if (!project) {
      return res.status(404).json({ error: 'Building not found.' });
    }

    const building = await prisma.buildings.findFirst({
      where: {
        id: buildingId,
        project_id: project.id,
        is_whole_property_listing: true,
      },
      include: {
        projects: {
          select: wholeBuildingProjectSelect,
        },
      },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found.' });
    }

    res.json(sanitizePublicWholeBuilding(building.projects || {}, formatPublicBuildingDetail(building)));  } catch (err) {
    console.error('Error fetching public building detail:', err);
    res.status(500).json({ error: err.message });
  }
};
