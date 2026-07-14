const DEFAULT_ADMIN_URL = 'http://localhost:5173';

function normalizeOrigin(value) {
    return String(value || '')
        .trim()
        .replace(/\/$/, '');
}

function getAdminUrl() {
    return normalizeOrigin(process.env.ADMIN_URL || DEFAULT_ADMIN_URL);
}

/**
 * Origins allowed to call the API from the browser (admin + public website).
 * Supports comma-separated extras via CORS_ORIGINS.
 */
function getCorsOrigins() {
    const { getWebsiteUrl } = require('./siteUrls');
    const origins = new Set();

    const add = (value) => {
        const origin = normalizeOrigin(value);
        if (!origin) return;
        origins.add(origin);
        try {
            const url = new URL(origin);
            if (url.hostname.startsWith('www.')) {
                origins.add(`${url.protocol}//${url.hostname.slice(4)}`);
            } else if (url.hostname.includes('.')) {
                origins.add(`${url.protocol}//www.${url.hostname}`);
            }
        } catch {
            // ignore invalid URLs
        }
    };

    add(getAdminUrl());
    add(getWebsiteUrl());

    String(process.env.CORS_ORIGINS || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach(add);

    return [...origins];
}

module.exports = {
    DEFAULT_ADMIN_URL,
    getAdminUrl,
    getCorsOrigins,
};
