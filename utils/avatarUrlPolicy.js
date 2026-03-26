/**
 * Chỉ lưu URL http(s) trong DB; từ chối data URL (base64) để đồng bộ với upload qua presigned.
 */

const MAX_AVATAR_URL_LENGTH = 2048;

/**
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
function normalizeAvatarForDb(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    const s = String(value).trim();
    if (s === '') return null;

    if (/^data:/i.test(s)) {
        const err = new Error('AVATAR_DATA_URL_NOT_ALLOWED');
        err.code = 'AVATAR_DATA_URL_NOT_ALLOWED';
        throw err;
    }
    if (s.length > MAX_AVATAR_URL_LENGTH) {
        const err = new Error('AVATAR_URL_TOO_LONG');
        err.code = 'AVATAR_URL_TOO_LONG';
        throw err;
    }
    if (!/^https?:\/\/.+/i.test(s)) {
        const err = new Error('AVATAR_URL_MUST_BE_HTTP');
        err.code = 'AVATAR_URL_MUST_BE_HTTP';
        throw err;
    }

    /** Tuỳ chọn: chỉ chấp nhận URL cùng prefix với PUBLIC_ASSET_BASE_URL (R2 public / CDN) — bật bằng AVATAR_STRICT_PUBLIC_PREFIX=1 */
    const strict =
        process.env.AVATAR_STRICT_PUBLIC_PREFIX === '1' || String(process.env.AVATAR_STRICT_PUBLIC_PREFIX).toLowerCase() === 'true';
    const baseRaw = process.env.PUBLIC_ASSET_BASE_URL;
    if (strict && baseRaw != null && String(baseRaw).trim() !== '') {
        const base = String(baseRaw).replace(/\/$/, '');
        if (s !== base && !s.startsWith(`${base}/`)) {
            const err = new Error('AVATAR_URL_MUST_MATCH_PUBLIC_ASSET_PREFIX');
            err.code = 'AVATAR_URL_MUST_MATCH_PUBLIC_ASSET_PREFIX';
            throw err;
        }
    }

    return s;
}

module.exports = { normalizeAvatarForDb, MAX_AVATAR_URL_LENGTH };
