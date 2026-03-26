/**
 * Presigned PUT — key tùy ý (avatar, products, categories, …). Cùng bucket + PUBLIC_ASSET_BASE_URL.
 */

const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getS3Client } = require('./s3Client');

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PRESIGN_EXPIRES_SEC = 300;

const EXT_BY_TYPE = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif'
};

function isObjectStorageConfigured() {
    return !!(
        process.env.S3_BUCKET &&
        process.env.PUBLIC_ASSET_BASE_URL &&
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY
    );
}

/**
 * @param {{ key: string, contentType: string, fileSize?: number }} opts
 */
async function createPresignedPutObject(opts) {
    if (!isObjectStorageConfigured()) {
        const err = new Error('AVATAR_STORAGE_NOT_CONFIGURED');
        err.code = 'NOT_CONFIGURED';
        throw err;
    }

    const contentType = String(opts.contentType || '').trim();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        const err = new Error('INVALID_IMAGE_CONTENT_TYPE');
        err.code = 'VALIDATION';
        throw err;
    }

    if (opts.fileSize != null) {
        const n = Number(opts.fileSize);
        if (!Number.isFinite(n) || n < 1 || n > MAX_FILE_BYTES) {
            const err = new Error('INVALID_IMAGE_FILE_SIZE');
            err.code = 'VALIDATION';
            throw err;
        }
    }

    const key = String(opts.key || '').trim();
    if (!key || key.includes('..') || key.startsWith('/')) {
        const err = new Error('INVALID_OBJECT_KEY');
        err.code = 'VALIDATION';
        throw err;
    }

    const bucket = process.env.S3_BUCKET;
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000'
    });

    const client = getS3Client();
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SEC });

    const base = String(process.env.PUBLIC_ASSET_BASE_URL).replace(/\/$/, '');
    const publicUrl = `${base}/${key}`;

    return {
        uploadUrl,
        publicUrl,
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        expiresIn: PRESIGN_EXPIRES_SEC
    };
}

module.exports = {
    createPresignedPutObject,
    isObjectStorageConfigured,
    ALLOWED_CONTENT_TYPES,
    EXT_BY_TYPE,
    MAX_FILE_BYTES,
    PRESIGN_EXPIRES_SEC
};
