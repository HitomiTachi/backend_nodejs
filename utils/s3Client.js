/**
 * S3-compatible client (Cloudflare R2, AWS S3, MinIO) — dùng chung presign.
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { effectiveS3Region, isR2CloudflareEndpoint } = require('./r2Env');

function getS3Client() {
    const endpoint = process.env.S3_ENDPOINT || undefined;
    const isR2 = isR2CloudflareEndpoint(endpoint);
    const forcePathStyle =
        !isR2 &&
        (process.env.S3_FORCE_PATH_STYLE === '1' ||
            String(process.env.S3_FORCE_PATH_STYLE).toLowerCase() === 'true');

    return new S3Client({
        region: effectiveS3Region(),
        endpoint,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        forcePathStyle
    });
}

module.exports = { getS3Client };
