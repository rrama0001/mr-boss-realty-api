const { extractObjectKey, loadObjectBuffer } = require('../services/objectStorage');
const fs = require('fs');
const path = require('path');

function resolveUploadKey(req) {
    const mountedPath = String(req.path || '');
    if (/^\/projects\/\d+\//i.test(mountedPath)) {
        return mountedPath.replace(/^\/+/, '');
    }

    return extractObjectKey(req.originalUrl || req.url);
}

/**
 * Serve /uploads/* from local disk first, then from Cloudflare R2.
 * Keeps existing API URLs working after deploy wipes the local uploads folder.
 */
function createUploadsMiddleware() {
    return async function serveUploads(req, res, next) {
        try {
            const key = resolveUploadKey(req);
            if (!key || key.includes('..')) {
                return next();
            }

            const localPath = path.join(__dirname, '..', 'uploads', ...key.split('/'));
            try {
                await fs.promises.access(localPath);
                return res.sendFile(localPath);
            } catch {
                // fall through to R2
            }

            const object = await loadObjectBuffer(key);
            if (!object?.buffer) {
                return res.status(404).send('Not found');
            }

            if (object.contentType) {
                res.setHeader('Content-Type', object.contentType);
            }
            if (object.cacheControl) {
                res.setHeader('Cache-Control', object.cacheControl);
            }

            return res.send(object.buffer);
        } catch (err) {
            console.error('Error serving upload:', err);
            return res.status(500).send('Failed to load upload');
        }
    };
}

module.exports = {
    createUploadsMiddleware,
};
