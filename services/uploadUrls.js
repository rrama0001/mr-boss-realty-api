const fs = require('fs');
const path = require('path');

function getUploadsRoot() {
    return path.join(__dirname, '..', 'uploads');
}

/**
 * Host origin for public upload URLs (no trailing slash, no /api suffix).
 * Uploads are served at /uploads, not under /api.
 */
function getApiPublicBaseUrl() {
    const configured = String(process.env.API_URL || '').trim();
    if (configured) {
        return configured.replace(/\/$/, '').replace(/\/api$/i, '');
    }

    const port = process.env.PORT || 3000;
    return `http://localhost:${port}`;
}

function getPublicUploadUrl(relativePath) {
    const normalized = String(relativePath || '').replace(/^\/+/, '');
    return `${getApiPublicBaseUrl()}/uploads/${normalized}`;
}

/** Fix legacy URLs that incorrectly include /api before /uploads. */
function normalizeStoredUploadUrl(url) {
    const value = String(url || '').trim();
    if (!value) return value;
    return value.replace(/\/api\/uploads\//gi, '/uploads/');
}

function uploadPathnameToRelative(pathname) {
    const pathValue = String(pathname || '');
    if (pathValue.startsWith('/api/uploads/')) {
        return pathValue.slice('/api/uploads/'.length);
    }
    if (pathValue.startsWith('/uploads/')) {
        return pathValue.slice('/uploads/'.length);
    }
    return null;
}

async function deleteStoredUploadFile(imageLink) {
    if (!imageLink) return;

    try {
        const { pathname } = new URL(imageLink);
        const relativePath = uploadPathnameToRelative(pathname);
        if (!relativePath) return;

        const filePath = path.join(getUploadsRoot(), relativePath);
        await fs.promises.unlink(filePath);
    } catch {
        // ignore missing files or invalid URLs
    }
}

function isUnitOwnedUploadUrl(imageLink) {
    return /\/uploads\/projects\/\d+\/units\//i.test(String(imageLink || ''));
}

module.exports = {
    getUploadsRoot,
    getApiPublicBaseUrl,
    getPublicUploadUrl,
    normalizeStoredUploadUrl,
    deleteStoredUploadFile,
    isUnitOwnedUploadUrl,
    uploadPathnameToRelative,
};
