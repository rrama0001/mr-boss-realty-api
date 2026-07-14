const { prisma } = require('../prisma/prismaClient');
const { isShareableMediaUrl } = require('./aiPropertySnapshot');
const { deleteStoredUploadFile, isUnitOwnedUploadUrl } = require('./uploadUrls');

const ASSET_KIND_UNIT = 'unit';

const VIDEO_HOST =
    /(?:^|\.)((?:youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com|vimeo\.com|player\.vimeo\.com))$/i;

function isCardImageUrl(url) {
    if (!isShareableMediaUrl(url)) return false;

    const trimmed = url.trim();
    if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(trimmed)) return false;

    try {
        const { hostname } = new URL(trimmed);
        if (VIDEO_HOST.test(hostname.replace(/^www\./, ''))) return false;
    } catch {
        return false;
    }

    return true;
}

function normalizeImageUrls(imageUrls = []) {
    return [...new Set(
        (Array.isArray(imageUrls) ? imageUrls : [])
            .map((url) => String(url || '').trim())
            .filter(Boolean),
    )];
}

async function listUnitImageUrls(unitId) {
    const assets = await prisma.assets.findMany({
        where: {
            unit_id: unitId,
            kind: ASSET_KIND_UNIT,
            image_link: { not: null },
        },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });

    return assets
        .map((asset) => asset.image_link?.trim())
        .filter(Boolean);
}

async function syncUnitImageAssets(unitId, projectId, imageUrls = []) {
    const urls = normalizeImageUrls(imageUrls);

    const existing = await prisma.assets.findMany({
        where: {
            unit_id: unitId,
            kind: ASSET_KIND_UNIT,
        },
    });

    const existingUrlSet = new Set(existing.map((asset) => asset.image_link));
    const nextUrlSet = new Set(urls);

    const toRemove = existing.filter((asset) => !nextUrlSet.has(asset.image_link));
    const toAdd = urls.filter((url) => !existingUrlSet.has(url));

    for (const asset of toRemove) {
        if (isUnitOwnedUploadUrl(asset.image_link)) {
            await deleteStoredUploadFile(asset.image_link);
        }
    }

    await prisma.$transaction([
        ...toRemove.map((asset) => prisma.assets.delete({ where: { id: asset.id } })),
        ...toAdd.map((url) => prisma.assets.create({
            data: {
                project_id: projectId,
                unit_id: unitId,
                kind: ASSET_KIND_UNIT,
                image_link: url,
            },
        })),
    ]);

    return urls;
}

function normalizeCoverImageUrl(coverImageUrl, assetUrls = []) {
    const urls = normalizeImageUrls(assetUrls);
    const cover = String(coverImageUrl || '').trim();
    if (!cover || !isUnitOwnedUploadUrl(cover)) return null;
    return urls.includes(cover) ? cover : null;
}

/** Prefer unit uploads / picked photos over legacy images_videos_link placeholders. */
function pickUnitImage(unit = {}) {
    if (isCardImageUrl(unit.cover_image_url)) {
        return unit.cover_image_url.trim();
    }

    const assets = (unit.assets || []).filter(
        (asset) => isCardImageUrl(asset.image_link),
    );

    const unitUpload = assets.find((asset) => isUnitOwnedUploadUrl(asset.image_link));
    if (unitUpload) {
        return unitUpload.image_link.trim();
    }

    if (assets.length > 0) {
        return assets[0].image_link.trim();
    }

    if (isCardImageUrl(unit.images_videos_link)) {
        return unit.images_videos_link.trim();
    }

    return null;
}

async function applyUnitCoverImage(prismaClient, unitId, coverImageUrl, assetUrls) {
    const cover = normalizeCoverImageUrl(coverImageUrl, assetUrls);
    return prismaClient.units.update({
        where: { id: unitId },
        data: { cover_image_url: cover },
    });
}

module.exports = {
    ASSET_KIND_UNIT,
    listUnitImageUrls,
    syncUnitImageAssets,
    pickUnitImage,
    isCardImageUrl,
    normalizeCoverImageUrl,
    applyUnitCoverImage,
};
