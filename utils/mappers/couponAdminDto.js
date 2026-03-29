/**
 * Admin list/detail DTO for coupons — matches storefront admin UI fields where possible.
 * @param {object} doc — lean mongoose coupon
 * @param {number} usedCount
 */
function toCouponAdminDto(doc, usedCount) {
    const validTo = doc.validTo ? new Date(doc.validTo) : null;
    return {
        id: doc.id,
        code: doc.code,
        discountType: doc.type === 'PERCENT' ? 'percent' : 'fixed',
        type: doc.type,
        value: doc.value,
        minOrderAmount: doc.minOrderAmount != null ? doc.minOrderAmount : 0,
        maxDiscountAmount: doc.maxDiscountAmount != null ? doc.maxDiscountAmount : null,
        validFrom: doc.validFrom ? new Date(doc.validFrom).toISOString() : null,
        validTo: validTo ? validTo.toISOString() : null,
        expiresAt: validTo ? validTo.toISOString() : null,
        usageLimit: doc.usageLimit != null ? doc.usageLimit : null,
        maxUses: doc.usageLimit != null ? doc.usageLimit : null,
        perUserLimit: doc.perUserLimit != null ? doc.perUserLimit : null,
        active: Boolean(doc.active),
        usedCount: Number(usedCount) || 0,
        excludedProductIds: doc.excludedProductIds || [],
        applicableCategoryIds: doc.applicableCategoryIds || []
    };
}

module.exports = { toCouponAdminDto };
