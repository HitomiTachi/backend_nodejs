/**
 * Pure VAT helpers. Storefront unit prices are treated as GROSS (đã gồm VAT) unless caller passes NET.
 * rate: decimal (e.g. 0.1 for 10%).
 */

function roundVnd(amount) {
    return Math.round(Number(amount));
}

/**
 * Tax included in a gross line: tax = gross * r / (1 + r)
 */
function taxFromGrossAmount(gross, rate) {
    const g = Number(gross);
    const r = Number(rate);
    if (!Number.isFinite(g) || g <= 0) return 0;
    if (!Number.isFinite(r) || r <= 0) return 0;
    return roundVnd((g * r) / (1 + r));
}

/**
 * Tax from net line: tax = net * r
 */
function taxFromNetAmount(net, rate) {
    const n = Number(net);
    const r = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (!Number.isFinite(r) || r <= 0) return 0;
    return roundVnd(n * r);
}

/**
 * @param {'GROSS'|'NET'} priceBasis
 * @param {number} unitPrice
 * @param {number} quantity
 * @param {number} rate effective decimal rate
 */
function lineTaxAndTotals(priceBasis, unitPrice, quantity, rate) {
    const qty = Math.max(0, Math.floor(Number(quantity)) || 0);
    const u = Number(unitPrice);
    const basis = priceBasis === 'NET' ? 'NET' : 'GROSS';
    if (qty <= 0 || !Number.isFinite(u) || u < 0) {
        return { lineGross: 0, lineNet: 0, taxAmount: 0 };
    }
    if (basis === 'GROSS') {
        const lineGross = roundVnd(u * qty);
        const taxAmount = taxFromGrossAmount(lineGross, rate);
        const lineNet = lineGross - taxAmount;
        return { lineGross, lineNet, taxAmount };
    }
    const lineNet = roundVnd(u * qty);
    const taxAmount = taxFromNetAmount(lineNet, rate);
    const lineGross = lineNet + taxAmount;
    return { lineGross, lineNet, taxAmount };
}

module.exports = {
    roundVnd,
    taxFromGrossAmount,
    taxFromNetAmount,
    lineTaxAndTotals
};
