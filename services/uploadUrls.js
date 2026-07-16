const {
    getUploadsRoot,
    getApiPublicBaseUrl,
    getPublicObjectUrl,
    deleteStoredObject,
    extractObjectKey,
} = require('./objectStorage');
const { getR2PublicBaseUrl } = require('./r2Storage');

function getPublicUploadUrl(relativePath) {
    const normalized = String(relativePath || '').replace(/^\/+/, '');
    return getPublicObjectUrl(normalized);
}

/**
 * Normalize stored media URLs:
 * - strip legacy `/api/uploads/` prefix
 * - rewrite local/API upload URLs to R2_PUBLIC_URL when configured
 */
function normalizeStoredUploadUrl(url) {
    const value = String(url || '').trim();
    if (!value) return value;

    const withoutApiPrefix = value.replace(/\/api\/uploads\//gi, '/uploads/');
    const publicBase = getR2PublicBaseUrl();
    if (!publicBase) {
        return withoutApiPrefix;
    }

    const key = extractObjectKey(withoutApiPrefix);
    if (key && /^projects\//i.test(key)) {
        return `${publicBase}/${key}`;
    }

    return withoutApiPrefix;
}

/**
 * Comparable key for upload URLs across absolute/relative and host differences.
 * e.g. http://localhost:3000/uploads/a.jpg and /uploads/a.jpg -> uploads/a.jpg
 * Also normalizes R2 public CDN URLs to the object key.
 */
function uploadUrlKey(url) {
    const normalized = String(url || '').trim();
    if (!normalized) return '';

    const objectKey = extractObjectKey(normalized.replace(/\/api\/uploads\//gi, '/uploads/'));
    if (objectKey) {
        return objectKey.toLowerCase();
    }

    try {
        if (/^https?:\/\//i.test(normalized)) {
            const { pathname } = new URL(normalized);
            return pathname.replace(/^\/+/, '').toLowerCase();
        }
    } catch {
        // fall through
    }

    return normalized.replace(/^\/+/, '').toLowerCase();
}

function uploadPathnameToRelative(pathname) {
    const pathValue = String(pathname || '');
    if (pathValue.startsWith('/api/uploads/')) {
        return pathValue.slice('/api/uploads/'.length);
    }
    if (pathValue.startsWith('/uploads/')) {
        return pathValue.slice('/uploads/'.length);
    }
    if (/^\/projects\/\d+\//i.test(pathValue)) {
        return pathValue.slice(1);
    }
    return null;
}

async function deleteStoredUploadFile(imageLink) {
    await deleteStoredObject(imageLink);
}

function isUnitOwnedUploadUrl(imageLink) {
    return /projects\/\d+\/units\//i.test(String(imageLink || ''));
}

module.exports = {
    getUploadsRoot,
    getApiPublicBaseUrl,
    getPublicUploadUrl,
    normalizeStoredUploadUrl,
    uploadUrlKey,
    deleteStoredUploadFile,
    isUnitOwnedUploadUrl,
    uploadPathnameToRelative,
};
