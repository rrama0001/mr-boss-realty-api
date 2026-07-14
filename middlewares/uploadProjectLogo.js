const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getUploadsRoot } = require('../services/uploadUrls');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

const storage = multer.diskStorage({
    destination(req, file, cb) {
        const projectId = String(req.params.id || 'unknown');
        const dir = path.join(getUploadsRoot(), 'projects', projectId);

        fs.mkdir(dir, { recursive: true }, (err) => {
            cb(err, dir);
        });
    },
    filename(req, file, cb) {
        cb(null, 'logo.jpg');
    },
});

function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
        return cb(new Error('Only JPG, PNG, WebP, GIF, or SVG images are allowed.'));
    }

    return cb(null, true);
}

const uploadProjectLogo = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = uploadProjectLogo;
