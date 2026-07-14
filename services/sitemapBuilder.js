const { prisma } = require('../prisma/prismaClient');
const { buildWebsitePath } = require('../config/siteUrls');
const { DEVELOPER_PAGE_PREFIX, STATIC_PAGES } = require('../config/sitemapPages');
const {
    buildListingDetailPath,
    buildPropertyDetailPath,
    cityToSlug,
    getProjectUrlSegments,
} = require('./projectPublicUrl');
const { slugifyPart } = require('./projectSlug');
const { buildBuildingRef } = require('./buildingSlug');
const { buildUnitRef } = require('./unitSlug');
const { isShareableMediaUrl } = require('./aiPropertySnapshot');

function resolveUnitListingRef(unit = {}) {
    const slug = String(unit.slug || '').trim();
    if (slug) return slug;
    if (unit.id != null) return buildUnitRef(unit.id);
    return '';
}

function resolveBuildingListingRef(building = {}) {
    const slug = String(building.slug || '').trim();
    if (slug) return slug;
    if (building.id != null) return buildBuildingRef(building.id);
    return '';
}

function pickProjectHeroImage(project = {}) {
    if (isShareableMediaUrl(project.images_videos_link)) {
        return project.images_videos_link.trim();
    }

    const assetImage = (project.assets || []).find(
        (asset) => !asset.unit_id && isShareableMediaUrl(asset.image_link),
    )?.image_link;

    return assetImage ? assetImage.trim() : null;
}

function pickUnitHeroImage(unit = {}) {
    if (isShareableMediaUrl(unit.cover_image_url)) {
        return unit.cover_image_url.trim();
    }

    const assetImage = (unit.assets || []).find(
        (asset) => isShareableMediaUrl(asset.image_link),
    )?.image_link;

    return assetImage ? assetImage.trim() : null;
}

function buildProjectRecord(project = {}) {
    const { citySlug, projectSlug } = getProjectUrlSegments(project);
    if (!citySlug || !projectSlug) {
        return null;
    }

    return {
        project,
        citySlug,
        projectSlug,
        path: buildPropertyDetailPath(project),
    };
}

function buildListingRecord(project = {}, listingRef = '', options = {}) {
    const record = buildProjectRecord(project);
    if (!record || !listingRef) return null;

    return {
        ...record,
        listingRef,
        path: buildListingDetailPath(project, listingRef),
        images: options.images || [],
        lastmod: options.lastmod || project.updated_at,
    };
}

async function buildStaticPageEntries() {
    const now = new Date();

    return STATIC_PAGES.map((page) => ({
        loc: buildWebsitePath(page.path),
        lastmod: now,
        changefreq: page.changefreq,
        priority: page.priority,
    }));
}

async function buildCityEntries() {
    const projects = await prisma.projects.findMany({
        where: {
            city: {
                not: null,
            },
        },
        select: {
            city: true,
            updated_at: true,
        },
    });

    const cityMap = new Map();

    for (const project of projects) {
        const city = String(project.city || '').trim();
        const citySlug = cityToSlug(city);
        if (!citySlug) continue;

        const existing = cityMap.get(citySlug);
        if (!existing || project.updated_at > existing.lastmod) {
            cityMap.set(citySlug, {
                loc: buildWebsitePath(`/properties/${citySlug}`),
                lastmod: project.updated_at,
                changefreq: 'daily',
                priority: '0.8',
            });
        }
    }

    return Array.from(cityMap.values()).sort((a, b) => a.loc.localeCompare(b.loc));
}

async function buildProjectEntries() {
    const projects = await prisma.projects.findMany({
        select: {
            id: true,
            project_name: true,
            slug: true,
            city: true,
            is_private_on_website: true,
            updated_at: true,
            images_videos_link: true,
            assets: {
                select: {
                    image_link: true,
                    unit_id: true,
                },
            },
        },
        orderBy: { updated_at: 'desc' },
    });

    return projects
        .map((project) => {
            const record = buildProjectRecord(project);
            if (!record) return null;

            const heroImage = pickProjectHeroImage(project);

            return {
                loc: buildWebsitePath(record.path),
                lastmod: project.updated_at,
                changefreq: 'weekly',
                priority: '0.8',
                images: heroImage ? [heroImage] : [],
            };
        })
        .filter(Boolean);
}

async function buildBuildingEntries() {
    const buildings = await prisma.buildings.findMany({
        where: {
            is_whole_property_listing: true,
        },
        select: {
            id: true,
            slug: true,
            updated_at: true,
            images_videos_link: true,
            projects: {
                select: {
                    project_name: true,
                    slug: true,
                    city: true,
                    is_private_on_website: true,
                    updated_at: true,
                },
            },
        },
        orderBy: { updated_at: 'desc' },
    });

    return buildings
        .map((building) => {
            const listingRef = resolveBuildingListingRef(building);
            const heroImage = isShareableMediaUrl(building.images_videos_link)
                ? building.images_videos_link.trim()
                : null;

            const record = buildListingRecord(building.projects, listingRef, {
                images: heroImage ? [heroImage] : [],
                lastmod: building.updated_at,
            });

            if (!record) return null;

            return {
                loc: buildWebsitePath(record.path),
                lastmod: building.updated_at,
                changefreq: 'weekly',
                priority: '0.7',
                images: record.images,
            };
        })
        .filter(Boolean);
}

async function buildUnitEntries() {
    const units = await prisma.units.findMany({
        select: {
            id: true,
            slug: true,
            updated_at: true,
            cover_image_url: true,
            assets: {
                select: {
                    image_link: true,
                },
            },
            projects: {
                select: {
                    project_name: true,
                    slug: true,
                    city: true,
                    is_private_on_website: true,
                    updated_at: true,
                },
            },
        },
        orderBy: { updated_at: 'desc' },
    });

    return units
        .map((unit) => {
            const listingRef = resolveUnitListingRef(unit);
            const heroImage = pickUnitHeroImage(unit);
            const record = buildListingRecord(unit.projects, listingRef, {
                images: heroImage ? [heroImage] : [],
                lastmod: unit.updated_at,
            });

            if (!record) return null;

            return {
                loc: buildWebsitePath(record.path),
                lastmod: unit.updated_at,
                changefreq: 'weekly',
                priority: '0.7',
                images: record.images,
            };
        })
        .filter(Boolean);
}

async function buildDeveloperEntries() {
    const projects = await prisma.projects.findMany({
        where: {
            developer: {
                not: null,
            },
        },
        select: {
            developer: true,
            updated_at: true,
        },
    });

    const developerMap = new Map();

    for (const project of projects) {
        const developer = String(project.developer || '').trim();
        const developerSlug = slugifyPart(developer);
        if (!developer || !developerSlug) continue;

        const existing = developerMap.get(developerSlug);
        if (!existing || project.updated_at > existing.lastmod) {
            developerMap.set(developerSlug, {
                loc: buildWebsitePath(`${DEVELOPER_PAGE_PREFIX}/${developerSlug}`),
                lastmod: project.updated_at,
                changefreq: 'weekly',
                priority: '0.5',
            });
        }
    }

    return Array.from(developerMap.values()).sort((a, b) => a.loc.localeCompare(b.loc));
}

async function getSitemapLastModified(type) {
    switch (type) {
        case 'pages':
            return new Date();
        case 'cities':
            return prisma.projects.findFirst({
                orderBy: { updated_at: 'desc' },
                select: { updated_at: true },
            }).then((row) => row?.updated_at || new Date());
        case 'projects':
            return prisma.projects.findFirst({
                orderBy: { updated_at: 'desc' },
                select: { updated_at: true },
            }).then((row) => row?.updated_at || new Date());
        case 'buildings':
            return prisma.buildings.findFirst({
                where: { is_whole_property_listing: true },
                orderBy: { updated_at: 'desc' },
                select: { updated_at: true },
            }).then((row) => row?.updated_at || new Date());
        case 'units':
            return prisma.units.findFirst({
                orderBy: { updated_at: 'desc' },
                select: { updated_at: true },
            }).then((row) => row?.updated_at || new Date());
        case 'developers':
            return prisma.projects.findFirst({
                where: { developer: { not: null } },
                orderBy: { updated_at: 'desc' },
                select: { updated_at: true },
            }).then((row) => row?.updated_at || new Date());
        default:
            return new Date();
    }
}

const SITEMAP_TYPES = ['pages', 'cities', 'projects', 'buildings', 'units', 'developers'];

async function buildSitemapEntries(type) {
    switch (type) {
        case 'pages':
            return buildStaticPageEntries();
        case 'cities':
            return buildCityEntries();
        case 'projects':
            return buildProjectEntries();
        case 'buildings':
            return buildBuildingEntries();
        case 'units':
            return buildUnitEntries();
        case 'developers':
            return buildDeveloperEntries();
        default:
            return [];
    }
}

module.exports = {
    SITEMAP_TYPES,
    buildSitemapEntries,
    getSitemapLastModified,
};
