const { effectiveUnitPrice } = require('../utils/mappers/cartDto');
const { deactivateExpiredCoupons } = require('../utils/couponExpirySync');
const CouponModel = require('../schemas/coupons');
const CouponRedemptionModel = require('../schemas/couponRedemptions');
const { nextSequentialId } = require('../utils/id');

const PRICE_BASIS = 'GROSS';

function roundVnd(amount) {
    return Math.round(Number(amount));
}

function allocateDiscountAcrossLines(lineGrosses, discountTotal) {
    const subtotal = lineGrosses.reduce((a, b) => a + b, 0);
    const d = Math.min(Math.max(0, Number(discountTotal) || 0), subtotal);
    if (lineGrosses.length === 0) {
        return [];
    }
    if (d === 0) {
        return lineGrosses.map(() => 0);
    }
    const shares = lineGrosses.map((g) => Math.floor((d * g) / subtotal));
    let diff = d - shares.reduce((a, b) => a + b, 0);
    let i = 0;
    while (diff > 0 && i < shares.length) {
        shares[i] += 1;
        diff -= 1;
        i += 1;
    }
    return shares;
}

/**
 * @param {string|null|undefined} couponCode
 * @param {number} userId
 * @param {number} subtotal
 * @param {number[]} productIds
 * @param {Map<number, number>} productIdToCategoryId
 * @param {import('mongoose').ClientSession|null} session
 */
async function validateAndComputeCouponDiscount(
    couponCode,
    userId,
    subtotal,
    productIds,
    productIdToCategoryId,
    session
) {
    if (couponCode == null || String(couponCode).trim() === '') {
        return { discountTotal: 0, coupon: null };
    }
    await deactivateExpiredCoupons();
    if (userId == null || Number(userId) <= 0) {
        const err = new Error('Can dang nhap de ap dung ma giam gia');
        err.status = 401;
        throw err;
    }
    const code = String(couponCode).trim().toUpperCase();
    const qCoupon = CouponModel.findOne({ code, active: true });
    const coupon = session ? await qCoupon.session(session).lean() : await qCoupon.lean();
    if (!coupon) {
        const err = new Error('Ma giam gia khong hop le');
        err.status = 400;
        throw err;
    }
    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
        const err = new Error('Ma giam gia chua co hieu luc');
        err.status = 400;
        throw err;
    }
    if (coupon.validTo && now > new Date(coupon.validTo)) {
        const err = new Error('Ma giam gia da het han');
        err.status = 400;
        throw err;
    }
    if (subtotal < (coupon.minOrderAmount || 0)) {
        const err = new Error('Don hang chua dat gia tri toi thieu cho ma giam gia');
        err.status = 400;
        throw err;
    }
    const excluded = new Set((coupon.excludedProductIds || []).map((x) => Number(x)));
    for (const pid of productIds) {
        if (excluded.has(pid)) {
            const err = new Error('Ma giam gia khong ap dung cho san pham trong don');
            err.status = 400;
            throw err;
        }
    }
    const applicable = coupon.applicableCategoryIds || [];
    if (applicable.length > 0) {
        const allowed = new Set(applicable.map((x) => Number(x)));
        for (const pid of productIds) {
            const catId = productIdToCategoryId.get(pid);
            if (catId == null || !allowed.has(Number(catId))) {
                const err = new Error('Ma giam gia khong ap dung cho danh muc trong don');
                err.status = 400;
                throw err;
            }
        }
    }
    if (coupon.usageLimit != null) {
        const qUsed = CouponRedemptionModel.countDocuments({ couponId: coupon.id });
        const used = session ? await qUsed.session(session) : await qUsed;
        if (used >= coupon.usageLimit) {
            const err = new Error('Ma giam gia da het luot su dung');
            err.status = 400;
            throw err;
        }
    }
    if (coupon.perUserLimit != null) {
        const qUser = CouponRedemptionModel.countDocuments({
            couponId: coupon.id,
            userId: Number(userId)
        });
        const usedByUser = session ? await qUser.session(session) : await qUser;
        if (usedByUser >= coupon.perUserLimit) {
            const err = new Error('Ban da su dung het luot voi ma giam gia nay');
            err.status = 400;
            throw err;
        }
    }

    let discountTotal = 0;
    if (coupon.type === 'PERCENT') {
        const pct = Math.min(100, Math.max(0, Number(coupon.value) || 0));
        discountTotal = Math.floor((subtotal * pct) / 100);
        if (coupon.maxDiscountAmount != null && discountTotal > coupon.maxDiscountAmount) {
            discountTotal = coupon.maxDiscountAmount;
        }
    } else {
        discountTotal = Math.min(Number(coupon.value) || 0, subtotal);
    }
    discountTotal = roundVnd(discountTotal);
    if (discountTotal < 0) {
        discountTotal = 0;
    }
    return { discountTotal, coupon };
}

/**
 * Build priced order lines (GROSS unit pricing). Applies optional coupon at order level with proportional allocation.
 *
 * @param {Array<{ productId: number, quantity: number, product: object }>} resolvedRows — lean product docs after stock check
 * @param {number} userId
 * @param {string|null} couponCode
 * @param {import('mongoose').ClientSession|null} session
 */
async function buildPricedOrderPayload(resolvedRows, userId, couponCode, session) {
    const preliminary = [];

    for (const row of resolvedRows) {
        const prod = row.product;
        const productId = row.productId;
        const quantity = row.quantity;
        const unit = effectiveUnitPrice(prod);
        const lineGross = roundVnd(unit * quantity);

        preliminary.push({
            productId,
            productName: prod.name || '',
            productImage: prod.image != null ? prod.image : null,
            quantity,
            priceAtOrder: unit,
            priceBasis: PRICE_BASIS,
            lineGross,
            categoryId: prod.category_id != null ? Number(prod.category_id) : null
        });
    }

    const lineGrosses = preliminary.map((p) => p.lineGross);
    const subtotal = lineGrosses.reduce((a, b) => a + b, 0);

    const productIds = preliminary.map((p) => p.productId);
    const productIdToCategoryId = new Map();
    for (const p of preliminary) {
        if (p.categoryId != null) {
            productIdToCategoryId.set(p.productId, p.categoryId);
        }
    }

    const { discountTotal, coupon } = await validateAndComputeCouponDiscount(
        couponCode,
        userId,
        subtotal,
        productIds,
        productIdToCategoryId,
        session
    );

    const allocations = allocateDiscountAcrossLines(lineGrosses, discountTotal);

    const items = [];
    for (let i = 0; i < preliminary.length; i++) {
        const row = preliminary[i];
        const alloc = allocations[i] || 0;
        items.push({
            productId: row.productId,
            productName: row.productName,
            productImage: row.productImage,
            quantity: row.quantity,
            priceAtOrder: row.priceAtOrder,
            priceBasis: row.priceBasis,
            lineGross: row.lineGross,
            lineDiscount: alloc
        });
    }

    const grandTotal = roundVnd(subtotal - discountTotal);

    return {
        items,
        subtotal,
        discountTotal,
        grandTotal,
        coupon: coupon
            ? { id: coupon.id, code: coupon.code }
            : null
    };
}

function activeProductFilterQuote(productId) {
    return {
        id: Number(productId),
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    };
}

/**
 * Báo giá giỏ (không trừ tồn kho) — dùng cho POST /checkout/quote.
 *
 * @param {import('mongoose').Model} productModel
 * @param {Map<number, number>} merged
 * @param {number} userId — 0 khi khách chưa đăng nhập (không dùng mã giảm giá)
 * @param {string|null} couponCode
 */
async function buildCheckoutQuote(productModel, merged, userId, couponCode) {
    const resolvedRows = [];
    for (const [productId, quantity] of merged) {
        const prod = await productModel.findOne(activeProductFilterQuote(productId)).lean();
        if (!prod) {
            const err = new Error(`San pham ${productId} khong ton tai`);
            err.status = 400;
            throw err;
        }
        resolvedRows.push({ productId, quantity, product: prod });
    }
    return buildPricedOrderPayload(resolvedRows, userId, couponCode, null);
}

/**
 * @param {import('mongoose').ClientSession} session
 */
async function createCouponRedemptionIfAny(session, coupon, orderId, userId) {
    if (!coupon) {
        return;
    }
    const id = await nextSequentialId(CouponRedemptionModel);
    await CouponRedemptionModel.create(
        [
            {
                id,
                couponId: coupon.id,
                userId: Number(userId),
                orderId: Number(orderId)
            }
        ],
        { session }
    );
}

module.exports = {
    buildPricedOrderPayload,
    buildCheckoutQuote,
    createCouponRedemptionIfAny,
    PRICE_BASIS
};
