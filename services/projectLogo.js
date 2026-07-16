const { prisma } = require('../prisma/prismaClient');
const { isShareableMediaUrl } = require('./aiPropertySnapshot');
const { deleteStoredUploadFile, normalizeStoredUploadUrl } = require('./uploadUrls');

const ASSET_KIND_LOGO = 'logo';

function isLogoAsset(asset = {}) {
    if (asset.kind === ASSET_KIND_LOGO) return true;
    if (asset.kind && asset.kind !== ASSET_KIND_LOGO) return false;
    return /\/logo\.(jpe?g|png|webp|gif|svg)(\?|#|$)/i.test(String(asset.image_link || ''));
}

function pickProjectLogo(project = {}) {
    const candidates = (project.assets || [])
        .filter((asset) => !asset.unit_id && isLogoAsset(asset) && isShareableMediaUrl(asset.image_link))
        .sort((a, b) => {
            const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return bTime - aTime;
        });

    const link = candidates[0]?.image_link?.trim() || null;
    return link ? normalizeStoredUploadUrl(link) : null;
}

async function findProjectLogoAsset(projectId) {
    const assets = await prisma.assets.findMany({
        where: {
            project_id: projectId,
            unit_id: null,
            image_link: { not: null },
        },
        orderBy: { updated_at: 'desc' },
    });

    return assets.find(isLogoAsset) || null;
}

async function getProjectLogoUrl(projectId) {
    const asset = await findProjectLogoAsset(projectId);
    const link = asset?.image_link?.trim() || null;
    return link ? normalizeStoredUploadUrl(link) : null;
}

async function deleteStoredLogoFile(imageLink) {
    await deleteStoredUploadFile(imageLink);
}

async function upsertProjectLogo(projectId, publicUrl) {
    const existing = await findProjectLogoAsset(projectId);

    if (existing) {
        if (existing.image_link !== publicUrl) {
            await deleteStoredLogoFile(existing.image_link);
        }

        return prisma.assets.update({
            where: { id: existing.id },
            data: { image_link: publicUrl, kind: ASSET_KIND_LOGO },
        });
    }

    return prisma.assets.create({
        data: {
            project_id: projectId,
            unit_id: null,
            kind: ASSET_KIND_LOGO,
            image_link: publicUrl,
        },
    });
}

async function removeProjectLogo(projectId) {
    const existing = await findProjectLogoAsset(projectId);
    if (!existing) return null;

    await deleteStoredLogoFile(existing.image_link);
    await prisma.assets.delete({ where: { id: existing.id } });
    return existing;
}

module.exports = {
    ASSET_KIND_LOGO,
    findProjectLogoAsset,
    getProjectLogoUrl,
    pickProjectLogo,
    upsertProjectLogo,
    removeProjectLogo,
    deleteStoredLogoFile,
    isLogoAsset,
};
