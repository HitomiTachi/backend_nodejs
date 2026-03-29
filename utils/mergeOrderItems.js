/**
 * Gộp các dòng trùng productId trong body đặt hàng / quote.
 * @param {unknown} rawItems
 * @returns {Map<number, number>} productId -> quantity
 */
function mergeOrderItems(rawItems) {
    const merged = new Map();
    if (!Array.isArray(rawItems)) {
        return merged;
    }
    for (const line of rawItems) {
        const productId = parseInt(String(line.productId), 10);
        if (Number.isNaN(productId)) continue;
        const q = Math.max(1, parseInt(String(line.quantity), 10) || 0);
        if (q <= 0) continue;
        merged.set(productId, (merged.get(productId) || 0) + q);
    }
    return merged;
}

module.exports = { mergeOrderItems };
