const { prisma } = require('../prisma/prismaClient');
const { isShareableMediaUrl } = require('./aiPropertySnapshot');
const {
    deleteStoredUploadFile,
    isUnitOwnedUploadUrl,
    normalizeStoredUploadUrl,
    uploadUrlKey,
} = require('./uploadUrls');

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
            .map((url) => normalizeStoredUploadUrl(String(url || '').trim()))
            .filter(Boolean),
    )];
}

function imageUrlsInclude(urls = [], candidate) {
    const key = uploadUrlKey(candidate);
    if (!key) return false;
    return (urls || []).some((url) => uploadUrlKey(url) === key);
}

function findMatchingImageUrl(urls = [], candidate) {
    const key = uploadUrlKey(candidate);
    if (!key) return null;
    return (urls || []).find((url) => uploadUrlKey(url) === key) || null;
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
        .map((asset) => normalizeStoredUploadUrl(asset.image_link?.trim() || ''))
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

    const existingKeys = new Set(
        existing.map((asset) => uploadUrlKey(asset.image_link)).filter(Boolean),
    );
    const nextKeys = new Set(urls.map((url) => uploadUrlKey(url)).filter(Boolean));

    const toRemove = existing.filter((asset) => {
        const key = uploadUrlKey(asset.image_link);
        return key && !nextKeys.has(key);
    });
    const toAdd = urls.filter((url) => !existingKeys.has(uploadUrlKey(url)));

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
    const cover = normalizeStoredUploadUrl(String(coverImageUrl || '').trim());
    if (!cover || !isUnitOwnedUploadUrl(cover)) return null;
    return findMatchingImageUrl(urls, cover);
}

/** Prefer unit uploads / picked photos over legacy images_videos_link placeholders. */
function pickUnitImage(unit = {}) {
    if (isCardImageUrl(unit.cover_image_url)) {
        return normalizeStoredUploadUrl(unit.cover_image_url.trim());
    }

    const assets = (unit.assets || []).filter(
        (asset) => isCardImageUrl(asset.image_link),
    );

    const unitUpload = assets.find((asset) => isUnitOwnedUploadUrl(asset.image_link));
    if (unitUpload) {
        return normalizeStoredUploadUrl(unitUpload.image_link.trim());
    }

    if (assets.length > 0) {
        return normalizeStoredUploadUrl(assets[0].image_link.trim());
    }

    if (isCardImageUrl(unit.images_videos_link)) {
        return normalizeStoredUploadUrl(unit.images_videos_link.trim());
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
    imageUrlsInclude,
    findMatchingImageUrl,
};
