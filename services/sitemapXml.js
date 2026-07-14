function escapeXml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatLastMod(date) {
    if (!date) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

function renderUrlEntry(entry = {}) {
    const parts = [`    <url>`, `      <loc>${escapeXml(entry.loc)}</loc>`];

    const lastmod = formatLastMod(entry.lastmod);
    if (lastmod) {
        parts.push(`      <lastmod>${lastmod}</lastmod>`);
    }

    if (entry.changefreq) {
        parts.push(`      <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    }

    if (entry.priority != null && entry.priority !== '') {
        parts.push(`      <priority>${escapeXml(entry.priority)}</priority>`);
    }

    for (const image of entry.images || []) {
        if (!image) continue;
        parts.push('      <image:image>');
        parts.push(`        <image:loc>${escapeXml(image)}</image:loc>`);
        parts.push('      </image:image>');
    }

    parts.push('    </url>');
    return parts.join('\n');
}

function renderUrlSet(entries = []) {
    const body = entries.map((entry) => renderUrlEntry(entry)).join('\n');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        body,
        '</urlset>',
    ].join('\n');
}

function renderSitemapIndex(entries = []) {
    const body = entries.map((entry) => {
        const parts = [
            '  <sitemap>',
            `    <loc>${escapeXml(entry.loc)}</loc>`,
        ];

        const lastmod = formatLastMod(entry.lastmod);
        if (lastmod) {
            parts.push(`    <lastmod>${lastmod}</lastmod>`);
        }

        parts.push('  </sitemap>');
        return parts.join('\n');
    }).join('\n');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        body,
        '</sitemapindex>',
    ].join('\n');
}

module.exports = {
    escapeXml,
    formatLastMod,
    renderSitemapIndex,
    renderUrlSet,
};
