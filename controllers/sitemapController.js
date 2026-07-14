const { buildWebsitePath, getWebsiteUrl } = require('../config/siteUrls');
const {
    SITEMAP_TYPES,
    buildSitemapEntries,
    getSitemapLastModified,
} = require('../services/sitemapBuilder');
const { renderSitemapIndex, renderUrlSet } = require('../services/sitemapXml');

function sendXml(res, body) {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(body);
}

exports.getSitemapIndex = async (req, res) => {
    try {
        const entries = await Promise.all(
            SITEMAP_TYPES.map(async (type) => ({
                loc: buildWebsitePath(`/sitemap-${type}.xml`),
                lastmod: await getSitemapLastModified(type),
            })),
        );

        sendXml(res, renderSitemapIndex(entries));
    } catch (error) {
        console.error('Sitemap index error:', error);
        res.status(500).send('Failed to generate sitemap index.');
    }
};

exports.getSitemapByType = async (req, res) => {
    try {
        const type = String(req.params.type || '').trim().toLowerCase();

        if (!SITEMAP_TYPES.includes(type)) {
            return res.status(404).send('Sitemap not found.');
        }

        const entries = await buildSitemapEntries(type);
        sendXml(res, renderUrlSet(entries));
    } catch (error) {
        console.error(`Sitemap ${req.params.type} error:`, error);
        res.status(500).send('Failed to generate sitemap.');
    }
};

exports.getRobotsTxt = (req, res) => {
    const websiteUrl = getWebsiteUrl();
    const body = [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${websiteUrl}/sitemap.xml`,
        '',
    ].join('\n');

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(body);
};
