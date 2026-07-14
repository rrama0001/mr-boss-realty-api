const { prisma } = require('../prisma/prismaClient');
const {
    BUILDING_STATUSES,
    MIXED_PHASES,
    STATUS_LABELS,
} = require('../constants/buildingStatuses');

const VALID_VALUES = new Set(BUILDING_STATUSES.map((item) => item.value));

function isValidBuildingStatus(status) {
    if (!status) return false;
    return VALID_VALUES.has(String(status).trim());
}

function getStatusLabel(status) {
    if (!status) return null;
    return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

function deriveProjectStatus(buildings = [], fallback = null) {
    const statuses = buildings
        .map((building) => building.status)
        .filter(Boolean);

    if (!statuses.length) {
        return fallback || null;
    }

    const unique = [...new Set(statuses)];
    if (unique.length === 1) {
        return unique[0];
    }

    return MIXED_PHASES;
}

async function syncProjectStatus(projectId) {
    const project = await prisma.projects.findUnique({
        where: { id: projectId },
        select: { status: true },
    });

    if (!project) return null;

    const buildings = await prisma.buildings.findMany({
        where: { project_id: projectId },
        select: { status: true },
    });

    const derived = deriveProjectStatus(buildings, project.status);

    await prisma.projects.update({
        where: { id: projectId },
        data: { status: derived },
    });

    return derived;
}

module.exports = {
    BUILDING_STATUSES,
    MIXED_PHASES,
    STATUS_LABELS,
    isValidBuildingStatus,
    getStatusLabel,
    deriveProjectStatus,
    syncProjectStatus,
};
