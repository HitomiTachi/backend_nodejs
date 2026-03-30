/**
 * SKU rules (docs/CHECKLIST_IMPORT_B_EVOLUTION_INTO_C.md A1):
 * trim, uppercase, max 64, allowed [A-Za-z0-9_-] (stored uppercase).
 */

const SKU_MAX = 64;

function normalizeSku(raw) {
    if (raw == null) return '';
    return String(raw).trim().toUpperCase();
}

/**
 * @returns {string|null} error message, or null if valid
 */
function validateSkuInput(raw) {
    const s = normalizeSku(raw);
    if (!s) return 'SKU is required';
    if (s.length > SKU_MAX) return `SKU must be at most ${SKU_MAX} characters`;
    if (!/^[A-Z0-9_-]+$/.test(s)) {
        return 'SKU may only contain letters, digits, hyphen (-) and underscore (_)';
    }
    return null;
}

module.exports = {
    SKU_MAX,
    normalizeSku,
    validateSkuInput
};
