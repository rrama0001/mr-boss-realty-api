const path = require('path');
const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const uploadUnitImages = multer({
    storage: multer.memoryStorage(),
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
