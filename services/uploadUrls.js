const fs = require('fs');
const path = require('path');

function getUploadsRoot() {
    return path.join(__dirname, '..', 'uploads');
}

function getApiPublicBaseUrl() {
    const configured = String(process.env.API_URL || '').trim();
    if (configured) {
        return configured.replace(/\/$/, '');
    }

    const port = process.env.PORT || 3000;
    return `http://localhost:${port}`;
}

function getPublicUploadUrl(relativePath) {
    const normalized = String(relativePath || '').replace(/^\/+/, '');
    return `${getApiPublicBaseUrl()}/uploads/${normalized}`;
}

async function deleteStoredUploadFile(imageLink) {
    if (!imageLink) return;

    try {
        const { pathname } = new URL(imageLink);
        if (!pathname.startsWith('/uploads/')) return;

        const relativePath = pathname.replace(/^\/uploads\//, '');
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
    deleteStoredUploadFile,
    isUnitOwnedUploadUrl,
};
