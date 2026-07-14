/**
 * Static website paths included in sitemap-pages.xml.
 * Update paths here when routes are finalized.
 */
const LEGAL_PAGE_PATHS = [
    '/privacy-policy',
    '/terms-and-conditions',
    '/cookie-policy',
    '/ai-disclaimer',
    '/property-disclaimer',
    '/fair-housing',
    '/sitemap',
];

const STATIC_PAGES = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/properties', changefreq: 'daily', priority: '0.9' },
    { path: '/about', changefreq: 'monthly', priority: '0.6' },
    { path: '/contact', changefreq: 'monthly', priority: '0.6' },
    ...LEGAL_PAGE_PATHS.map((path) => ({
        path,
        changefreq: 'monthly',
        priority: '0.4',
    })),
];

/** Prefix for developer profile pages when that section launches. */
const DEVELOPER_PAGE_PREFIX = '/developers';

module.exports = {
    DEVELOPER_PAGE_PREFIX,
    LEGAL_PAGE_PATHS,
    STATIC_PAGES,
};
