// api/controllers/buildingController.js
const { prisma } = require('../prisma/prismaClient');
const { isValidBuildingType } = require('../services/buildingTypes');
const { isValidBuildingStatus, syncProjectStatus } = require('../services/buildingStatuses');
const {
  parseOptionalInt,
  normalizeWholeListingFields,
  normalizeWholeListingDetails,
  validateWholeListingFields,
} = require('../services/buildingWholeListing');
const { syncBuildingSlug } = require('../services/buildingSlug');
const {
  softDeleteBuildingCascade,
  restoreBuilding,
} = require('../services/softDelete');

async function buildBuildingData(body, { requireStatus = false } = {}) {
  const {
    building_type,
    building_name,
    number_of_units,
    lts_completion_date,
    cts_completion_date,
    total_available_units,
    total_parking,
    total_available_parking,
    freebies,
    status,
  } = body;

  if (requireStatus && !isValidBuildingStatus(status)) {
    return { error: 'Status is required. Choose Under Construction, Pre-Selling, or RFO.' };
  }

  if (status && !isValidBuildingStatus(status)) {
    return { error: 'Invalid building status.' };
  }

  const wholeListingFields = normalizeWholeListingFields(body);
  const wholeListingError = validateWholeListingFields(wholeListingFields);
  if (wholeListingError) {
    return { error: wholeListingError };
  }

  const isWhole = wholeListingFields.is_whole_property_listing;
  const isRfo = String(status || '').toLowerCase() === 'rfo';

  const wholeListingDetails = normalizeWholeListingDetails(body, isWhole);

  return {
    data: {
      building_type,
      building_name,
      number_of_units: isWhole
        ? parseOptionalInt(number_of_units)
        : (parseOptionalInt(number_of_units) ?? 0),
      lts_completion_date: isWhole || isRfo || !lts_completion_date ? null : new Date(lts_completion_date),
      cts_completion_date: isWhole || isRfo || !cts_completion_date ? null : new Date(cts_completion_date),
      total_available_units: isWhole ? null : (parseOptionalInt(total_available_units) ?? 0),
      total_parking: parseOptionalInt(total_parking) ?? 0,
      total_available_parking: parseOptionalInt(total_available_parking) ?? 0,
      freebies,
      status: status || null,
      ...wholeListingDetails,
      ...wholeListingFields,
    },
  };
}

async function assertCanEnableWholeListing(buildingId, isWhole) {
  if (!isWhole || buildingId == null) return null;

  const unitCount = await prisma.units.count({
    where: { building_id: buildingId },
  });

  if (unitCount > 0) {
    return 'Cannot list as whole property while units/rooms exist. Remove all units first.';
  }

  return null;
}

// Create a new building
exports.create = async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { building_type } = req.body;

    if (building_type && !(await isValidBuildingType(building_type))) {
      return res.status(400).json({ error: 'Invalid building type.' });
    }

    const built = await buildBuildingData(req.body, { requireStatus: true });
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    if (!built.data.is_whole_property_listing && !(built.data.number_of_units > 0)) {
      return res.status(400).json({ error: 'Number of units/rooms is required.' });
    }

    let newBuilding = await prisma.buildings.create({
      data: {
        project_id: projectId,
        ...built.data,
      },
    });

    newBuilding = await syncBuildingSlug(prisma, newBuilding.id);

    await syncProjectStatus(projectId);

    res.json(newBuilding);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get buildings by project ID
exports.getByProject = async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const buildings = await prisma.buildings.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { units: true },
        },
      },
    });
    res.json(buildings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get building by ID
exports.getOne = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const building = await prisma.buildings.findUnique({
      where: { id },
      include: {
        projects: true,
        _count: {
          select: { units: true },
        },
      },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    res.json(building);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get units for a building
exports.getUnits = async (req, res) => {
  try {
    const buildingId = parseInt(req.params.id, 10);
    const building = await prisma.buildings.findUnique({
      where: { id: buildingId },
      select: { is_whole_property_listing: true },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    if (building.is_whole_property_listing) {
      return res.status(400).json({ error: 'This building is listed as a whole property and has no units/rooms.' });
    }

    const units = await prisma.units.findMany({
      where: { building_id: buildingId },
      orderBy: [{ floor: 'asc' }, { room_number: 'asc' }],
    });
    res.json(units);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Update building by ID
exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.buildings.findUnique({
      where: { id },
      select: { project_id: true, building_type: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Building not found' });
    }

    const nextBuildingType = req.body.building_type ?? existing.building_type;
    if (
      nextBuildingType
      && nextBuildingType !== existing.building_type
      && !(await isValidBuildingType(nextBuildingType))
    ) {
      return res.status(400).json({ error: 'Invalid building type.' });
    }

    const wholeListingFields = normalizeWholeListingFields(req.body);
    const wholeListingGuard = await assertCanEnableWholeListing(id, wholeListingFields.is_whole_property_listing);
    if (wholeListingGuard) {
      return res.status(400).json({ error: wholeListingGuard });
    }

    const built = await buildBuildingData(req.body);
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    if (!built.data.is_whole_property_listing && !(built.data.number_of_units > 0)) {
      return res.status(400).json({ error: 'Number of units/rooms is required.' });
    }

    let updatedBuilding = await prisma.buildings.update({
      where: { id },
      data: built.data,
    });

    updatedBuilding = await syncBuildingSlug(prisma, id);

    await syncProjectStatus(existing.project_id);

    res.json(updatedBuilding);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.buildings.findFirst({
      where: { id, deleted_at: null },
      select: { project_id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Building not found' });
    }

    await softDeleteBuildingCascade(prisma, id);
    await syncProjectStatus(existing.project_id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.restore = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await restoreBuilding(prisma, id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.record?.project_id) {
      await syncProjectStatus(result.record.project_id);
    }

    res.json(result.record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
