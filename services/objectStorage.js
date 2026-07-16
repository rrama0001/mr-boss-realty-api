const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    isR2Configured,
    putR2Object,
    deleteR2Object,
    getR2Object,
    getR2PublicBaseUrl,
} = require('./r2Storage');

function getUploadsRoot() {
    return path.join(__dirname, '..', 'uploads');
}

function getApiPublicBaseUrl() {
    const configured = String(process.env.API_URL || '').trim();
    if (configured) {
        return configured.replace(/\/$/, '').replace(/\/api$/i, '');
    }

    const port = process.env.PORT || 3000;
    return `http://localhost:${port}`;
}

function extensionFromFile(file, fallback = '.jpg') {
    const fromName = path.extname(file?.originalname || '').toLowerCase();
    if (fromName) return fromName;

    const mime = String(file?.mimetype || '').toLowerCase();
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'image/svg+xml') return '.svg';
    if (mime === 'image/jpeg') return '.jpg';

    return fallback;
}

function buildObjectKey(relativeDir, filename) {
    return path.posix.join(String(relativeDir || '').replace(/^\/+|\/+$/g, ''), filename);
}

function getPublicObjectUrl(key) {
    const normalized = String(key || '').replace(/^\/+/, '');
    const r2Public = getR2PublicBaseUrl();
    if (r2Public) {
        return `${r2Public}/${normalized}`;
    }

    return `${getApiPublicBaseUrl()}/uploads/${normalized}`;
}

async function writeLocalUpload(key, buffer) {
    const absolutePath = path.join(getUploadsRoot(), ...String(key).split('/'));
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, buffer);
    return absolutePath;
}

/**
 * Persist a multer memory file to R2 (preferred) or local uploads/.
 * @returns {{ key: string, publicUrl: string, filename: string }}
 */
async function persistUploadedFile(file, relativeDir, { filename } = {}) {
    if (!file?.buffer) {
        throw new Error('Upload file buffer is missing.');
    }

    const resolvedFilename = filename
        || `${crypto.randomUUID()}${extensionFromFile(file)}`;
    const key = buildObjectKey(relativeDir, resolvedFilename);

    if (isR2Configured()) {
        await putR2Object({
            key,
            body: file.buffer,
            contentType: file.mimetype || 'application/octet-stream',
        });
    } else {
        await writeLocalUpload(key, file.buffer);
    }

    return {
        key,
        filename: resolvedFilename,
        publicUrl: getPublicObjectUrl(key),
    };
}

async function deleteStoredObject(keyOrUrl) {
    const key = extractObjectKey(keyOrUrl);
    if (!key) return;

    if (isR2Configured()) {
        try {
            await deleteR2Object(key);
        } catch {
            // ignore missing remote objects
        }
    }

    try {
        const absolutePath = path.join(getUploadsRoot(), ...key.split('/'));
        await fs.promises.unlink(absolutePath);
    } catch {
        // ignore missing local files
    }
}

function extractObjectKey(keyOrUrl) {
    const value = String(keyOrUrl || '').trim();
    if (!value) return null;

    if (!/^https?:\/\//i.test(value) && !value.startsWith('/')) {
        return value.replace(/^\/+/, '');
    }

    try {
        const parsed = new URL(value, getApiPublicBaseUrl());
        const pathname = parsed.pathname || '';
        const publicBase = getR2PublicBaseUrl();

        if (publicBase) {
            const publicOrigin = new URL(publicBase).origin;
            if (parsed.origin === publicOrigin) {
                return pathname.replace(/^\/+/, '') || null;
            }
        }

        if (pathname.startsWith('/api/uploads/')) {
            return pathname.slice('/api/uploads/'.length);
        }
        if (pathname.startsWith('/uploads/')) {
            return pathname.slice('/uploads/'.length);
        }
        if (/^\/projects\/\d+\//i.test(pathname)) {
            return pathname.slice(1);
        }
    } catch {
        // fall through
    }

    return null;
}

async function loadObjectBuffer(key) {
    const normalizedKey = String(key || '').replace(/^\/+/, '');
    if (!normalizedKey) return null;

    if (isR2Configured()) {
        const object = await getR2Object(normalizedKey);
        if (object?.Body) {
            const chunks = [];
            for await (const chunk of object.Body) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }

            return {
                buffer: Buffer.concat(chunks),
                contentType: object.ContentType || 'application/octet-stream',
                cacheControl: object.CacheControl || 'public, max-age=31536000',
            };
        }
    }

    try {
        const absolutePath = path.join(getUploadsRoot(), ...normalizedKey.split('/'));
        const buffer = await fs.promises.readFile(absolutePath);
        return {
            buffer,
            contentType: undefined,
            cacheControl: 'public, max-age=31536000',
        };
    } catch {
        return null;
    }
}

module.exports = {
    persistUploadedFile,
    deleteStoredObject,
    extractObjectKey,
    getPublicObjectUrl,
    loadObjectBuffer,
    buildObjectKey,
    getUploadsRoot,
    getApiPublicBaseUrl,
};
