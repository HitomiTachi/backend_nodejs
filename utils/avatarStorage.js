/**
 * Avatar: key prefix `avatars/{userId}/…` — gọi objectStoragePresign.
 */

const crypto = require('crypto');
const { createPresignedPutObject, isObjectStorageConfigured, ALLOWED_CONTENT_TYPES, EXT_BY_TYPE, MAX_FILE_BYTES, PRESIGN_EXPIRES_SEC } = require('./objectStoragePresign');

function isAvatarStorageConfigured() {
    return isObjectStorageConfigured();
}

/**
 * @param {{ userId: number|string, contentType: string, fileSize?: number }} opts
 */
async function createAvatarPresignedPut(opts) {
    const contentType = String(opts.contentType || '').trim();
    const ext = EXT_BY_TYPE[contentType];
    if (!ext) {
        const err = new Error('INVALID_AVATAR_CONTENT_TYPE');
        err.code = 'VALIDATION';
        throw err;
    }
    const key = `avatars/${opts.userId}/${crypto.randomUUID()}.${ext}`;
    return createPresignedPutObject({ key, contentType, fileSize: opts.fileSize });
}

module.exports = {
    createAvatarPresignedPut,
    isAvatarStorageConfigured,
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_BYTES,
    PRESIGN_EXPIRES_SEC
};
