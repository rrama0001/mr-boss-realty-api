// api/routes/units.js
const express = require('express');
const router = express.Router();
const path = require('path');
const { prisma } = require('../prisma/prismaClient');
const { isValidUnitType } = require('../services/unitTypes');
const unitPublicController = require('../controllers/unitPublicController');
const { syncUnitSlug } = require('../services/unitSlug');
const { listUnitImageUrls, syncUnitImageAssets, applyUnitCoverImage } = require('../services/unitAssets');
const { normalizeUnitListingFields, validateUnitListingFields } = require('../services/unitListing');
const uploadUnitImages = require('../middlewares/uploadUnitImages');
const { persistUploadedFile } = require('../services/objectStorage');

const unitInclude = {
  projects: true,
  buildings: true,
  assets: {
    where: { kind: 'unit' },
    select: { id: true, image_link: true },
  },
};

function optionalString(value) {
    if (value === '' || value === undefined || value == null) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
}

function optionalInt(value) {
    if (value === '' || value === undefined || value === null) return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function buildUnitData(body) {
    const {
        project_id,
        building_id,
        floor,
        room_number,
        unit_type,
        unit_size,
        bedrooms,
        bathrooms,
        unit_price,
        listing_type,
        monthly_rent,
        daily_rent,
        hourly_rent,
        payment_terms,
        images_videos_link,
        payment_terms_link,
        reservation_fee,
        is_reservation_deductible,
        monthly_dues_per_sqm,
        monthly_dues,
        is_pet_allowed,
        allowed_pet_size,
        is_allowed_smoking,
    ai_notes,
  } = body;

  const listingFields = normalizeUnitListingFields({
    listing_type,
    unit_price,
    monthly_rent,
    daily_rent,
    hourly_rent,
  });

  return {
        project_id: parseInt(project_id, 10),
        building_id: parseInt(building_id, 10),
        floor: parseInt(floor, 10),
        room_number,
        unit_type,
        unit_size: optionalString(unit_size),
        bedrooms: optionalInt(bedrooms),
        bathrooms: optionalInt(bathrooms),
        ...listingFields,
        payment_terms: optionalString(payment_terms),
        images_videos_link: optionalString(images_videos_link),
        payment_terms_link: optionalString(payment_terms_link),
        reservation_fee: parseFloat(reservation_fee) || 0,
        is_reservation_deductible: !!is_reservation_deductible,
        monthly_dues_per_sqm: parseFloat(monthly_dues_per_sqm) || 0,
        monthly_dues: parseFloat(monthly_dues) || 0,
        is_pet_allowed: !!is_pet_allowed,
        allowed_pet_size: optionalString(allowed_pet_size),
        is_allowed_smoking: !!is_allowed_smoking,
        ai_notes: optionalString(ai_notes),
    };
}

async function finalizeUnitSave(unitId, body) {
    let asset_image_urls = await listUnitImageUrls(unitId);

    if (Array.isArray(body.asset_image_urls)) {
        const unit = await prisma.units.findUnique({ where: { id: unitId } });
        asset_image_urls = await syncUnitImageAssets(unitId, unit.project_id, body.asset_image_urls);
    }

    if ('cover_image_url' in body) {
        await applyUnitCoverImage(prisma, unitId, body.cover_image_url, asset_image_urls);
    }

    const unit = await prisma.units.findUnique({
        where: { id: unitId },
        include: unitInclude,
    });

    return { ...unit, asset_image_urls };
}

function buildUnitUpdateData(body) {
    const { project_id, building_id, ...fields } = buildUnitData(body);

    return {
        ...fields,
        projects: { connect: { id: project_id } },
        buildings: { connect: { id: building_id } },
    };
}

// Public listing for website (must be before /:id)
router.get('/public/list', unitPublicController.getPublicListing);
router.get('/public/:citySlug/:projectSlug/:unitRef', unitPublicController.getPublicDetailBySegments);
router.get('/public/:projectSlug/:unitRef', unitPublicController.getPublicDetail);
router.get('/public/:slug', unitPublicController.getPublicDetailLegacy);

// 🟢 Get all units (with relations)
router.get('/projects/list', async (req, res) => {
  try {
    const units = await prisma.units.findMany({
      include: {
        projects: true,
        buildings: true,
      },
    });
    res.json(units);
  } catch (err) {
    console.error("❌ Error fetching units:", err);
    res.status(500).json({ error: "Failed to fetch units" });
  }
});

// 🟢 Get all units (basic)
router.get('/', async (req, res) => {
  try {
    const units = await prisma.units.findMany({
      include: {
        projects: true,
        buildings: true,
      },
    });
    res.json(units);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch units" });
  }
});

// 🟢 Get one unit
router.get('/:id', async (req, res) => {
  try {
    const unit = await prisma.units.findUnique({
      where: { id: parseInt(req.params.id) },
      include: unitInclude,
    });

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    const asset_image_urls = await listUnitImageUrls(unit.id);
    res.json({ ...unit, asset_image_urls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch unit" });
  }
});

// 🟢 Create a new unit
router.post('/', async (req, res) => {
  try {
    const { unit_type, building_id } = req.body;

    if (!(await isValidUnitType(unit_type))) {
      return res.status(400).json({ error: 'Invalid unit type.' });
    }

    const building = await prisma.buildings.findUnique({
      where: { id: parseInt(building_id, 10) },
      select: { is_whole_property_listing: true },
    });

    if (!building) {
      return res.status(400).json({ error: 'Building not found.' });
    }

    if (building.is_whole_property_listing) {
      return res.status(400).json({ error: 'This building is listed as a whole property and cannot have units/rooms.' });
    }

    const listingFields = normalizeUnitListingFields(req.body);
    const listingError = validateUnitListingFields(listingFields);
    if (listingError) {
      return res.status(400).json({ error: listingError });
    }

    const newUnit = await prisma.units.create({
      data: buildUnitData(req.body),
    });

    const syncedUnit = await syncUnitSlug(prisma, newUnit.id);
    const savedUnit = await finalizeUnitSave(syncedUnit.id, req.body);
    res.json(savedUnit);
  } catch (err) {
    console.error("❌ Error creating unit:", err);
    res.status(500).json({ error: "Failed to create unit" });
  }
});

// 🟢 Upload unit-specific images
router.post('/:id/images', async (req, res, next) => {
  try {
    const unitId = parseInt(req.params.id, 10);
    const unit = await prisma.units.findUnique({ where: { id: unitId } });

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    req.unit = unit;

    uploadUnitImages.array('images', 20)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Invalid upload.' });
      }

      try {
        if (!req.files?.length) {
          return res.status(400).json({ error: 'No image files provided.' });
        }

        const existingUrls = await listUnitImageUrls(unitId);
        const uploadedUrls = [];
        for (const file of req.files) {
          const stored = await persistUploadedFile(
            file,
            path.posix.join('projects', String(unit.project_id), 'units', String(unitId)),
          );
          uploadedUrls.push(stored.publicUrl);
        }
        const replaceUrl = optionalString(req.body.replace_url);
        const nextUrls = replaceUrl && existingUrls.includes(replaceUrl)
          ? existingUrls.filter((url) => url !== replaceUrl).concat(uploadedUrls)
          : [...existingUrls, ...uploadedUrls];
        const asset_image_urls = await syncUnitImageAssets(
          unitId,
          unit.project_id,
          nextUrls,
        );

        const currentUnit = await prisma.units.findUnique({ where: { id: unitId } });
        if (replaceUrl && currentUnit?.cover_image_url === replaceUrl && uploadedUrls[0]) {
          await applyUnitCoverImage(prisma, unitId, uploadedUrls[0], asset_image_urls);
        }

        res.json({ asset_image_urls, uploaded: uploadedUrls, replaced: replaceUrl || null });
      } catch (uploadErr) {
        console.error('Error uploading unit images:', uploadErr);
        res.status(500).json({ error: uploadErr.message || 'Failed to upload unit images.' });
      }
    });
  } catch (err) {
    console.error('Error preparing unit image upload:', err);
    res.status(500).json({ error: err.message || 'Failed to upload unit images.' });
  }
});

// 🟢 Update a unit
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const unitId = parseInt(id, 10);
    const existingUnit = await prisma.units.findUnique({ where: { id: unitId } });

    if (!existingUnit) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    const payload = buildUnitUpdateData(req.body);
    const listingError = validateUnitListingFields({
      listing_type: payload.listing_type,
      unit_price: payload.unit_price,
      monthly_rent: payload.monthly_rent,
      daily_rent: payload.daily_rent,
      hourly_rent: payload.hourly_rent,
    });
    if (listingError) {
      return res.status(400).json({ error: listingError });
    }

    if (
      payload.unit_type
      && !(await isValidUnitType(payload.unit_type))
      && payload.unit_type !== existingUnit.unit_type
    ) {
      return res.status(400).json({ error: 'Invalid unit type.' });
    }

    const updatedUnit = await prisma.units.update({
      where: { id: unitId },
      data: payload,
    });

    const syncedUnit = await syncUnitSlug(prisma, updatedUnit.id);
    const savedUnit = await finalizeUnitSave(syncedUnit.id, req.body);
    res.json(savedUnit);
  } catch (err) {
    console.error('❌ Error updating unit:', err);
    res.status(500).json({ error: 'Failed to update unit' });
  }
});

// 🟢 Delete a unit
router.delete('/:id', async (req, res) => {
  try {
    await prisma.units.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete unit" });
  }
});

module.exports = router;
