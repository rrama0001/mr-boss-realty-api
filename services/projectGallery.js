const { prisma } = require('../prisma/prismaClient');
const { deleteStoredLogoFile } = require('./projectLogo');
const { uploadUrlKey } = require('./uploadUrls');

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

/**
 * Replace a gallery image file in place (crop / re-upload).
 * Updates unit listings that referenced the old URL and property cover if needed.
 */
async function replaceGalleryImage(assetId, projectId, newPublicUrl) {
    const asset = await prisma.assets.findFirst({
        where: {
            id: assetId,
            project_id: projectId,
            unit_id: null,
            kind: ASSET_KIND_GALLERY,
        },
    });

    if (!asset) return null;

    const oldUrl = asset.image_link;
    const oldKey = uploadUrlKey(oldUrl || '');

    const updated = await prisma.assets.update({
        where: { id: asset.id },
        data: { image_link: newPublicUrl },
    });

    if (oldUrl && oldUrl !== newPublicUrl) {
        await prisma.assets.updateMany({
            where: {
                project_id: projectId,
                kind: 'unit',
                image_link: oldUrl,
            },
            data: { image_link: newPublicUrl },
        });

        const project = await prisma.projects.findUnique({
            where: { id: projectId },
            select: { cover_image_url: true },
        });
        const coverKey = uploadUrlKey(project?.cover_image_url || '');
        if (coverKey && oldKey && coverKey === oldKey) {
            await prisma.projects.update({
                where: { id: projectId },
                data: { cover_image_url: newPublicUrl },
            });
        }

        await prisma.units.updateMany({
            where: {
                project_id: projectId,
                cover_image_url: oldUrl,
            },
            data: { cover_image_url: newPublicUrl },
        });

        const leftover = await prisma.assets.count({
            where: { image_link: oldUrl },
        });
        if (leftover === 0) {
            await deleteStoredLogoFile(oldUrl);
        }
    }

    return updated;
}

module.exports = {
    ASSET_KIND_GALLERY,
    listProjectGallery,
    createGalleryAsset,
    updateGalleryLabel,
    removeGalleryAsset,
    replaceGalleryImage,
    countUnitReferencesToImageUrl,
};
