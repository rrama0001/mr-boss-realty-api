const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

let cachedClient = null;

function readConfig() {
    const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
    const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
    const bucket = String(process.env.R2_BUCKET || '').trim();
    const endpoint = String(process.env.R2_ENDPOINT || '').trim()
        || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
    const publicBaseUrl = String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');

    return {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucket,
        endpoint,
        publicBaseUrl,
    };
}

function isR2Configured() {
    const config = readConfig();
    return Boolean(
        config.bucket
        && config.endpoint
        && config.accessKeyId
        && config.secretAccessKey,
    );
}

function getR2Client() {
    if (!isR2Configured()) {
        return null;
    }

    if (cachedClient) {
        return cachedClient;
    }

    const config = readConfig();
    cachedClient = new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });

    return cachedClient;
}

function getR2Bucket() {
    return readConfig().bucket;
}

function getR2PublicBaseUrl() {
    return readConfig().publicBaseUrl || null;
}

async function putR2Object({ key, body, contentType }) {
    const client = getR2Client();
    if (!client) {
        throw new Error('Cloudflare R2 is not configured.');
    }

    const normalizedKey = String(key || '').replace(/^\/+/, '');
    await client.send(new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: normalizedKey,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
        // Avoid immutable so overwritten keys (e.g. logo.jpg) can refresh in CDNs/browsers.
        CacheControl: 'public, max-age=86400',
    }));

    return normalizedKey;
}

async function deleteR2Object(key) {
    const client = getR2Client();
    if (!client || !key) return false;

    const normalizedKey = String(key || '').replace(/^\/+/, '');
    await client.send(new DeleteObjectCommand({
        Bucket: getR2Bucket(),
        Key: normalizedKey,
    }));

    return true;
}

async function getR2Object(key) {
    const client = getR2Client();
    if (!client || !key) return null;

    const normalizedKey = String(key || '').replace(/^\/+/, '');
    try {
        return await client.send(new GetObjectCommand({
            Bucket: getR2Bucket(),
            Key: normalizedKey,
        }));
    } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
            return null;
        }
        throw err;
    }
}

module.exports = {
    isR2Configured,
    getR2Client,
    getR2Bucket,
    getR2PublicBaseUrl,
    putR2Object,
    deleteR2Object,
    getR2Object,
    readConfig,
};
