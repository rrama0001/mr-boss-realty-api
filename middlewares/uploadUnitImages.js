const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { getUploadsRoot } = require('../services/uploadUrls');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const uploadUnitImages = multer({
    storage: multer.diskStorage({
        destination(req, file, cb) {
            const projectId = String(req.unit?.project_id || 'unknown');
            const unitId = String(req.params.id || 'unknown');
            const dir = path.join(getUploadsRoot(), 'projects', projectId, 'units', unitId);

            fs.mkdir(dir, { recursive: true }, (err) => {
                cb(err, dir);
            });
        },
        filename(req, file, cb) {
            const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
            cb(null, `${crypto.randomUUID()}${ext}`);
        },
    }),
    fileFilter(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
            return cb(new Error('Only JPG, PNG, WebP, or GIF images are allowed.'));
        }

        return cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024, files: 20 },
});

module.exports = uploadUnitImages;
