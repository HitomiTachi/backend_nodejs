/**
 * Phí ship do server quyết định — không tin client.
 * - DEFAULT_SHIPPING_FEE: VND (mặc định 30_000), có thể 0.
 * - FREE_SHIPPING_MIN_SUBTOTAL: ngưỡng tiền hàng sau giảm (grandTotal hàng) để miễn phí ship.
 *   Đặt 0 hoặc để trống = không áp dụng miễn phí theo ngưỡng (luôn thu DEFAULT_SHIPPING_FEE).
 */

function parseEnvInt(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
        return fallback;
    }
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {number} goodsAfterDiscount — tiền hàng sau giảm giá (chưa cộng ship), đồng bộ priced.grandTotal
 * @returns {number} phí ship VND (làm tròn số nguyên)
 */
function computeShippingFee(goodsAfterDiscount) {
    const defaultFee = Math.max(0, parseEnvInt('DEFAULT_SHIPPING_FEE', 30000));
    const threshold = parseEnvInt('FREE_SHIPPING_MIN_SUBTOTAL', 500000);
    const goods = Math.max(0, Number(goodsAfterDiscount) || 0);
    if (threshold <= 0) {
        return defaultFee;
    }
    if (goods >= threshold) {
        return 0;
    }
    return defaultFee;
}

module.exports = {
    computeShippingFee,
    parseEnvInt
};
