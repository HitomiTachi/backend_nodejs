const crypto = require('crypto');

function hashResetToken(plain) {
    return crypto.createHash('sha256').update(String(plain), 'utf8').digest('hex');
}

/** Trả token thô (gửi trong email) và bản hash lưu DB. */
function generateResetToken() {
    const plain = crypto.randomBytes(32).toString('hex');
    return { plain, hash: hashResetToken(plain) };
}

module.exports = { hashResetToken, generateResetToken };
