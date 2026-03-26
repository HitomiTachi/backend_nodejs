/**
 * Nhận diện Cloudflare R2 (S3-compatible) và region mặc định cho AWS SDK v3.
 * Dùng chung cho avatarStorage — tránh lệch cấu hình giữa presign và tài liệu R2.
 */

/**
 * @param {string|undefined} endpoint
 * @returns {boolean}
 */
function isR2CloudflareEndpoint(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') return false;
    return endpoint.includes('r2.cloudflarestorage.com');
}

/**
 * R2: Cloudflare khuyến nghị region `auto`. AWS S3: theo biến hoặc us-east-1.
 * @returns {string}
 */
function effectiveS3Region() {
    const r = process.env.S3_REGION;
    if (r != null && String(r).trim() !== '') {
        return String(r).trim();
    }
    if (isR2CloudflareEndpoint(process.env.S3_ENDPOINT)) {
        return 'auto';
    }
    return 'us-east-1';
}

module.exports = {
    isR2CloudflareEndpoint,
    effectiveS3Region
};
