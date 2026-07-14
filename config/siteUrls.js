function normalizeBaseUrl(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback.replace(/\/$/, '');
    return raw.replace(/\/$/, '');
}

function getWebsiteUrl() {
    return normalizeBaseUrl(
        process.env.WEBSITE_URL || process.env.SITE_URL || process.env.VITE_SITE_URL,
        'http://localhost:5174',
    );
}

function getApiPublicBaseUrl() {
    return normalizeBaseUrl(process.env.API_URL, `http://localhost:${process.env.PORT || 3000}`);
}

function buildWebsitePath(path = '') {
    const normalized = String(path || '').trim();
    if (!normalized || normalized === '/') {
        return getWebsiteUrl();
    }

    return `${getWebsiteUrl()}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

module.exports = {
    getWebsiteUrl,
    getApiPublicBaseUrl,
    buildWebsitePath,
};
