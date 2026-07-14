const { prisma } = require('../prisma/prismaClient');
const { deleteStoredLogoFile } = require('./projectLogo');

const ASSET_KIND_GALLERY = 'gallery';

async function listProjectGallery(projectId) {
    return prisma.assets.findMany({
        where: {
            project_id: projectId,
            unit_id: null,
            kind: ASSET_KIND_GALLERY,
        },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });
}

async function createGalleryAsset(projectId, publicUrl, imageLabel = null) {
    const label = String(imageLabel || '').trim() || null;

    return prisma.assets.create({
        data: {
            project_id: projectId,
            unit_id: null,
            kind: ASSET_KIND_GALLERY,
            image_link: publicUrl,
            image_label: label,
        },
    });
}

async function updateGalleryLabel(assetId, projectId, imageLabel) {
    const asset = await prisma.assets.findFirst({
        where: {
            id: assetId,
            project_id: projectId,
            unit_id: null,
            kind: ASSET_KIND_GALLERY,
        },
    });

    if (!asset) return null;

    const label = String(imageLabel || '').trim() || null;

    return prisma.assets.update({
        where: { id: asset.id },
        data: { image_label: label },
    });
}

async function countUnitReferencesToImageUrl(imageUrl) {
    if (!imageUrl) return 0;

    return prisma.assets.count({
        where: {
            kind: 'unit',
            image_link: imageUrl,
        },
    });
}

async function removeGalleryAsset(assetId, projectId) {
    const asset = await prisma.assets.findFirst({
        where: {
            id: assetId,
            project_id: projectId,
            unit_id: null,
            kind: ASSET_KIND_GALLERY,
        },
    });

    if (!asset) return null;

    const refs = await countUnitReferencesToImageUrl(asset.image_link);
    if (refs === 0) {
        await deleteStoredLogoFile(asset.image_link);
    }

    await prisma.assets.delete({ where: { id: asset.id } });
    return asset;
}

module.exports = {
    ASSET_KIND_GALLERY,
    listProjectGallery,
    createGalleryAsset,
    updateGalleryLabel,
    removeGalleryAsset,
    countUnitReferencesToImageUrl,
};
