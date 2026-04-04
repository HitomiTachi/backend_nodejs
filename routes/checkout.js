var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
require('../schemas/products');
const ProductModel = mongoose.model('Product');
const { mergeOrderItems } = require('../utils/mergeOrderItems');
const { optionalAuth } = require('../utils/authHandler');
const { buildCheckoutQuote } = require('../services/orderPricing');
const { computeShippingFee } = require('../utils/shippingFee');

/**
 * POST /checkout/quote
 * Body: { items: [{ productId, quantity }], couponCode? }
 * - Khách xem tạm tính từ giá server.
 * - Áp mã giảm giá cần đăng nhập (Authorization).
 */
router.post('/quote', optionalAuth, async function (req, res) {
    try {
        const rawItems = req.body.items;
        const couponRaw =
            req.body.couponCode !== undefined ? req.body.couponCode : req.body.coupon_code;
        const couponCode =
            couponRaw != null && String(couponRaw).trim() !== ''
                ? String(couponRaw).trim()
                : null;

        if (!Array.isArray(rawItems) || rawItems.length === 0) {
            return res.status(400).json({ message: 'items phai la mang khong rong' });
        }

        const merged = mergeOrderItems(rawItems);
        if (merged.size === 0) {
            return res.status(400).json({ message: 'Khong co dong hop le' });
        }

        const userId = req.user ? Number(req.user.id) : 0;
        const priced = await buildCheckoutQuote(ProductModel, merged, userId, couponCode);

        const goodsTotal = priced.grandTotal;
        const shippingFee = computeShippingFee(goodsTotal);
        const grandTotal = goodsTotal + shippingFee;

        res.json({
            subtotal: priced.subtotal,
            discountTotal: priced.discountTotal,
            goodsTotal,
            shippingFee,
            grandTotal,
            coupon: priced.coupon
        });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ message: err.message });
    }
});

module.exports = router;
