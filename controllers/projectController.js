// api/controllers/projectController.js
const path = require('path');
const { prisma } = require('../prisma/prismaClient');
const { deriveProjectStatus } = require('../services/buildingStatuses');
const { isShareableMediaUrl } = require('../services/aiPropertySnapshot');
const { isNumericId, resolveProjectSlug } = require('../services/projectSlug');
const { findProjectByUrlSegments } = require('../services/projectPublicUrl');
const { fetchPublicBuildingDetailBySegments } = require('./buildingPublicController');
const { fetchPublicUnitDetailBySegments } = require('./unitPublicController');
const {
  parseProjectWebsiteFields,
  assertCanSetFeatured,
  sortFeaturedProjects,
} = require('../services/projectFeatured');
const { buildPublicProjectNameFields } = require('../services/projectPublicDisplay');
const { collectWholeListingPrices } = require('../services/buildingWholeListing');
const { buildBuildingRef } = require('../services/buildingSlug');
const { buildUnitRef } = require('../services/unitSlug');
const {
  sanitizePublicProjectDetail,
  sanitizePublicProjectListing,
} = require('../services/publicFieldPolicy');
const {
  getProjectLogoUrl,
  pickProjectLogo,
  upsertProjectLogo,
  removeProjectLogo,
  isLogoAsset,
} = require('../services/projectLogo');
const {
  listProjectGallery,
  createGalleryAsset,
  updateGalleryLabel,
  removeGalleryAsset,
  countUnitReferencesToImageUrl,
} = require('../services/projectGallery');
const { getPublicUploadUrl, normalizeStoredUploadUrl } = require('../services/uploadUrls');
const { pickUnitImage } = require('../services/unitAssets');

function mapGalleryAsset(asset) {
  return {
    id: asset.id,
    url: normalizeStoredUploadUrl(asset.image_link),
    label: asset.image_label || '',
  };
}

function parseGalleryLabels(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((value) => String(value || '').trim());
  }

  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map((value) => String(value || '').trim()) : [];
  } catch {
    return [];
  }
}

function optionalString(value) {
  if (value === '' || value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function optionalUrl(value) {
  const trimmed = optionalString(value);
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const publicProjectInclude = {
  buildings: {
    orderBy: { building_name: 'asc' },
  },
  units: {
    include: {
      buildings: {
        select: {
          building_name: true,
          status: true,
          building_type: true,
        },
      },
      assets: {
        select: { image_link: true },
      },
    },
    orderBy: [
      { building_id: 'asc' },
      { floor: 'asc' },
      { room_number: 'asc' },
    ],
  },
  assets: {
    select: { image_link: true, unit_id: true, kind: true, updated_at: true },
  },
};

async function findProjectByPublicParam(param) {
  const value = String(param || '').trim();
  if (!value) return null;

  if (isNumericId(value)) {
    return prisma.projects.findUnique({
      where: { id: parseInt(value, 10) },
      include: publicProjectInclude,
    });
  }

  return prisma.projects.findUnique({
    where: { slug: value },
    include: publicProjectInclude,
  });
}

function collectProjectPrices(project) {
  const unitPrices = (project.units || [])
    .map((unit) => unit.unit_price)
    .filter((price) => typeof price === 'number' && price > 0);

  const wholeBuildingPrices = (project.buildings || [])
    .flatMap((building) => collectWholeListingPrices(building));

  return [...unitPrices, ...wholeBuildingPrices];
}

function formatPublicProjectDetail(project) {
  const prices = collectProjectPrices(project);

  const unitTypes = [...new Set(project.units.map((unit) => unit.unit_type).filter(Boolean))];
  const publicNameFields = buildPublicProjectNameFields(project);
  const wholeBuildingListings = (project.buildings || []).filter((building) => building.is_whole_property_listing);

  return sanitizePublicProjectDetail(project, {
    id: project.id,
    slug: project.slug,
    ...publicNameFields,
    developer: project.developer,
    developer_website: project.developer_website,
    city: project.city,
    description: project.description,
    status: deriveProjectStatus(project.buildings, project.status),
    amenities: project.amenities,
    loan_type: project.loan_type,
    reservation_requirements: project.reservation_requirements,
    image: pickProjectImage(project),
    logo: pickProjectLogo(project),
    buildingCount: project.buildings.length,
    unitCount: project.units.length,
    wholeBuildingCount: wholeBuildingListings.length,
    unitTypes,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    buildings: project.buildings.map((building) => ({
      id: building.id,
      slug: building.is_whole_property_listing
        ? (building.slug || buildBuildingRef(building.id))
        : null,
      building_name: building.building_name,
      building_type: building.building_type,
      status: building.status,
      total_available_units: building.total_available_units,
      is_whole_property_listing: Boolean(building.is_whole_property_listing),
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
    })),
    units: project.units.map((unit) => ({
      id: unit.id,
      slug: unit.slug || buildUnitRef(unit.id),
      project_slug: project.slug,
      unit_type: unit.unit_type,
      unit_size: unit.unit_size,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      unit_price: unit.unit_price,
      listing_type: unit.listing_type || 'sale',
      monthly_rent: unit.monthly_rent,
      daily_rent: unit.daily_rent,
      hourly_rent: unit.hourly_rent,
      building_id: unit.building_id,
      building_name: unit.buildings?.building_name || null,
      building_status: unit.buildings?.status || null,
      building_type: unit.buildings?.building_type || null,
      image: pickUnitImage(unit),
    })),
  });
}

function pickProjectImage(project) {
  if (isShareableMediaUrl(project.images_videos_link)) {
    return normalizeStoredUploadUrl(project.images_videos_link.trim());
  }

  const galleryImage = (project.assets || []).find(
    (asset) => !asset.unit_id
      && asset.kind === 'gallery'
      && isShareableMediaUrl(asset.image_link),
  )?.image_link;

  if (galleryImage) {
    return normalizeStoredUploadUrl(galleryImage.trim());
  }

  const assetImage = (project.assets || []).find(
    (asset) => !asset.unit_id
      && !isLogoAsset(asset)
      && isShareableMediaUrl(asset.image_link),
  )?.image_link;

  if (assetImage) {
    return normalizeStoredUploadUrl(assetImage.trim());
  }

  return null;
}

function mapProjectToPublicListing(project) {
  const prices = collectProjectPrices(project);

  const unitTypes = [...new Set(project.units.map((unit) => unit.unit_type).filter(Boolean))];
  const buildingTypes = [...new Set(project.buildings.map((building) => building.building_type).filter(Boolean))];
  const publicNameFields = buildPublicProjectNameFields(project);

  return sanitizePublicProjectListing({
    id: project.id,
    slug: project.slug,
    ...publicNameFields,
    developer: project.developer,
    developer_website: project.developer_website,
    city: project.city,
    description: project.description,
    status: deriveProjectStatus(project.buildings, project.status),
    amenities: project.amenities,
    images_videos_link: project.images_videos_link,
    buildingCount: project.buildings.length,
    unitCount: project.units.length,
    wholeBuildingCount: (project.buildings || []).filter((building) => building.is_whole_property_listing).length,
    unitTypes,
    buildingTypes,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    image: pickProjectImage(project),
    logo: pickProjectLogo(project),
    is_featured: Boolean(project.is_featured),
    featured_sort_order: project.featured_sort_order ?? null,
  });
}

const publicListingInclude = {
  buildings: {
    select: {
      id: true,
      status: true,
      building_type: true,
      is_whole_property_listing: true,
      listing_type: true,
      sale_price: true,
      monthly_rent: true,
      daily_rent: true,
      hourly_rent: true,
    },
  },
  units: { select: { unit_price: true, unit_type: true } },
  assets: { select: { image_link: true, kind: true, unit_id: true, updated_at: true } },
};

exports.getPublicListing = async (req, res) => {
  try {
    const projects = await prisma.projects.findMany({
      orderBy: { created_at: 'desc' },
      include: publicListingInclude,
    });

    res.json(projects.map(mapProjectToPublicListing));
  } catch (err) {
    console.error('Error fetching public project listing:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicFeatured = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 12);

    const projects = await prisma.projects.findMany({
      where: {
        is_featured: true,
        slug: { not: null },
      },
      include: publicListingInclude,
    });

    const listing = sortFeaturedProjects(projects)
      .slice(0, limit)
      .map(mapProjectToPublicListing);

    res.json(listing);
  } catch (err) {
    console.error('Error fetching featured public projects:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicPartners = async (req, res) => {
  try {
    const projects = await prisma.projects.findMany({
      where: {
        slug: { not: null },
        is_private_on_website: false,
      },
      orderBy: { project_name: 'asc' },
      include: {
        assets: { select: { image_link: true, kind: true, unit_id: true, updated_at: true } },
      },
    });

    const partners = projects
      .map((project) => {
        const logo = pickProjectLogo(project);
        if (!logo) return null;

        const publicNameFields = buildPublicProjectNameFields(project);

        return sanitizePublicProjectListing({
          id: project.id,
          slug: project.slug,
          ...publicNameFields,
          city: project.city,
          logo,
          is_private_on_website: false,
        });
      })
      .filter(Boolean);

    res.json(partners);
  } catch (err) {
    console.error('Error fetching public project partners:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicListingDetailBySegments = async (req, res) => {
  try {
    const { citySlug, projectSlug, listingRef } = req.params;

    const buildingPayload = await fetchPublicBuildingDetailBySegments(
      citySlug,
      projectSlug,
      listingRef,
    );

    if (buildingPayload) {
      return res.json(buildingPayload);
    }

    const unitPayload = await fetchPublicUnitDetailBySegments(
      citySlug,
      projectSlug,
      listingRef,
    );

    if (unitPayload) {
      return res.json(unitPayload);
    }

    return res.status(404).json({ error: 'Listing not found.' });
  } catch (err) {
    console.error('Error fetching public listing detail by segments:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicDetailBySegments = async (req, res) => {
  try {
    const projectRef = await findProjectByUrlSegments(
      prisma,
      req.params.citySlug,
      req.params.projectSlug,
      { id: true },
    );

    if (!projectRef) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const project = await prisma.projects.findUnique({
      where: { id: projectRef.id },
      include: publicProjectInclude,
    });

    if (!project) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    res.json(formatPublicProjectDetail(project));
  } catch (err) {
    console.error('Error fetching public project detail by segments:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicDetail = async (req, res) => {
  try {
    const project = await findProjectByPublicParam(req.params.slug);

    if (!project) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    res.json(formatPublicProjectDetail(project));
  } catch (err) {
    console.error('Error fetching public project detail:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const projects = await prisma.projects.findMany(
        {
            orderBy: { created_at: "desc" },
        }
    );
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const project = await prisma.projects.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!project) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const logo_url = normalizeStoredUploadUrl(await getProjectLogoUrl(project.id));
    const gallery_images = await listProjectGallery(project.id);

    res.json({
      ...project,
      logo_url,
      gallery_images: gallery_images.map(mapGalleryAsset),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const project = await prisma.projects.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const relativePath = path.posix.join('projects', String(projectId), req.file.filename);
    const publicUrl = getPublicUploadUrl(relativePath);
    const asset = await upsertProjectLogo(projectId, publicUrl);

    res.json({
      logo_url: normalizeStoredUploadUrl(asset.image_link),
      asset_id: asset.id,
    });
  } catch (err) {
    console.error('Error uploading property logo:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteLogo = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);

    const project = await prisma.projects.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    await removeProjectLogo(projectId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting property logo:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getGallery = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const project = await prisma.projects.findUnique({ where: { id: projectId } });

    if (!project) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const gallery = await listProjectGallery(projectId);
    res.json(gallery.map(mapGalleryAsset));
  } catch (err) {
    console.error('Error fetching property gallery:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadGallery = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);

    if (!req.files?.length) {
      return res.status(400).json({ error: 'No image files provided.' });
    }

    const project = await prisma.projects.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const labels = parseGalleryLabels(req.body?.labels);
    const created = [];

    for (let index = 0; index < req.files.length; index += 1) {
      const file = req.files[index];
      const relativePath = path.posix.join('projects', String(projectId), 'gallery', file.filename);
      const publicUrl = getPublicUploadUrl(relativePath);
      const asset = await createGalleryAsset(projectId, publicUrl, labels[index] || null);
      created.push(mapGalleryAsset(asset));
    }

    res.json({ images: created });
  } catch (err) {
    console.error('Error uploading property gallery images:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateGalleryImage = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const assetId = parseInt(req.params.assetId, 10);

    const asset = await updateGalleryLabel(assetId, projectId, req.body?.label);
    if (!asset) {
      return res.status(404).json({ error: 'Gallery image not found.' });
    }

    res.json(mapGalleryAsset(asset));
  } catch (err) {
    console.error('Error updating property gallery image label:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteGalleryImage = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const assetId = parseInt(req.params.assetId, 10);

    const asset = await prisma.assets.findFirst({
      where: {
        id: assetId,
        project_id: projectId,
        unit_id: null,
        kind: 'gallery',
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Gallery image not found.' });
    }

    const refs = await countUnitReferencesToImageUrl(asset.image_link);
    if (refs > 0) {
      return res.status(400).json({
        error: 'This image is assigned to one or more units or rooms. Remove it from those listings first.',
      });
    }

    await removeGalleryAsset(assetId, projectId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting property gallery image:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      developer,
      developer_website,
      developer_notes,
      project_name,
      city,
      location,
      description,
      showroom_location,
      images_videos_link,
      amenities,
      loan_type,
      reservation_requirements,
      contact_person,
      contact_person_position,
      contact_person_number,
      contact_person_email,
    } = req.body;

    const websiteFields = parseProjectWebsiteFields(req.body);
    await assertCanSetFeatured(prisma, websiteFields.is_featured);

    const slug = await resolveProjectSlug(
      prisma,
      project_name,
      city,
      null,
      websiteFields.is_private_on_website,
    );

    const project = await prisma.projects.create({
      data: {
        developer: optionalString(developer),
        developer_website: optionalUrl(developer_website),
        developer_notes: optionalString(developer_notes),
        project_name,
        slug,
        city,
        location,
        description,
        showroom_location,
        images_videos_link,
        amenities,
        loan_type,
        reservation_requirements,
        contact_person: optionalString(contact_person),
        contact_person_position: optionalString(contact_person_position),
        contact_person_number: optionalString(contact_person_number),
        contact_person_email: optionalString(contact_person_email),
        is_featured: websiteFields.is_featured,
        featured_sort_order: websiteFields.featured_sort_order,
        is_private_on_website: websiteFields.is_private_on_website,
      },
    });

    res.json(project);
  } catch (err) {
    console.error("❌ Error creating project:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.getUnitsByProject = async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const units = await prisma.units.findMany({
        where: { project_id: projectId },
        include: { projects: true, buildings: true }
      });
      res.json(units);
    } catch (err) {
      console.error('Error fetching units for project:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

exports.update = async (req, res) => {
  try {
    const {
      developer,
      developer_website,
      developer_notes,
      project_name,
      city,
      location,
      description,
      showroom_location,
      images_videos_link,
      amenities,
      loan_type,
      reservation_requirements,
      contact_person,
      contact_person_position,
      contact_person_number,
      contact_person_email,
    } = req.body;

    const projectId = parseInt(req.params.id, 10);
    const websiteFields = parseProjectWebsiteFields(req.body);
    await assertCanSetFeatured(prisma, websiteFields.is_featured, projectId);

    const slug = await resolveProjectSlug(
      prisma,
      project_name,
      city,
      projectId,
      websiteFields.is_private_on_website,
    );

    const project = await prisma.projects.update({
      where: { id: projectId },
      data: {
        developer: optionalString(developer),
        developer_website: optionalUrl(developer_website),
        developer_notes: optionalString(developer_notes),
        project_name,
        slug,
        city,
        location,
        description,
        showroom_location,
        images_videos_link,
        amenities,
        loan_type,
        reservation_requirements,
        contact_person: optionalString(contact_person),
        contact_person_position: optionalString(contact_person_position),
        contact_person_number: optionalString(contact_person_number),
        contact_person_email: optionalString(contact_person_email),
        is_featured: websiteFields.is_featured,
        featured_sort_order: websiteFields.featured_sort_order,
        is_private_on_website: websiteFields.is_private_on_website,
      },
    });

    res.json(project);
  } catch (err) {
    console.error("❌ Error updating project:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await prisma.projects.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
