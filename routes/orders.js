var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const OrderModel = require('../schemas/orders');
require('../schemas/products');
const ProductModel = mongoose.model('Product');
const { nextSequentialId } = require('../utils/id');
const { toOrderDto } = require('../utils/mappers/orderDto');
const {
    buildPricedOrderPayload,
    createCouponRedemptionIfAny
} = require('../services/orderPricing');
const { computeShippingFee } = require('../utils/shippingFee');

function activeProductFilter(productId) {
    return {
        id: Number(productId),
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    };
}

const { mergeOrderItems } = require('../utils/mergeOrderItems');

const ORDER_STATUS = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SHIPPING: 'SHIPPING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED'
};

const ALLOWED_STATUS_TRANSITIONS = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: []
};

function normalizeOrderStatus(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

router.get('/admin', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const pageRaw = req.query.page;
        const sizeRaw = req.query.size;
        const statusRaw = req.query.status;
        const userIdRaw = req.query.userId;

        const hasPage = pageRaw !== undefined && pageRaw !== null && String(pageRaw).trim() !== '';
        const hasSize = sizeRaw !== undefined && sizeRaw !== null && String(sizeRaw).trim() !== '';
        const page = hasPage ? Math.max(0, parseInt(String(pageRaw), 10)) : 0;
        const size = hasSize ? Math.min(200, Math.max(1, parseInt(String(sizeRaw), 10))) : 20;

        if ((hasPage && Number.isNaN(page)) || (hasSize && Number.isNaN(size))) {
            return res.status(400).json({ message: 'page/size khong hop le' });
        }

        const filter = {};
        if (statusRaw != null && String(statusRaw).trim() !== '') {
            filter.status = String(statusRaw).trim().toUpperCase();
        }
        if (userIdRaw != null && String(userIdRaw).trim() !== '') {
            const parsedUserId = parseInt(String(userIdRaw), 10);
            if (Number.isNaN(parsedUserId)) {
                return res.status(400).json({ message: 'userId khong hop le' });
            }
            filter.userId = parsedUserId;
        }

        const [total, docs] = await Promise.all([
            OrderModel.countDocuments(filter),
            OrderModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(page * size)
                .limit(size)
                .lean()
        ]);

        res.json({
            total,
            page,
            size,
            items: docs.map(toOrderDto)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/admin/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const doc = await OrderModel.findOne({ id: orderId }).lean();
        if (!doc) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }
        res.json(toOrderDto(doc));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/admin/:id/status', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }

        const nextStatus = normalizeOrderStatus(req.body.status);
        if (!nextStatus || !Object.prototype.hasOwnProperty.call(ALLOWED_STATUS_TRANSITIONS, nextStatus)) {
            return res.status(400).json({ message: 'status khong hop le' });
        }

        const existing = await OrderModel.findOne({ id: orderId }).lean();
        if (!existing) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }

        const currentStatus = normalizeOrderStatus(existing.status);
        if (!currentStatus || !Object.prototype.hasOwnProperty.call(ALLOWED_STATUS_TRANSITIONS, currentStatus)) {
            return res.status(400).json({ message: 'Trang thai hien tai khong hop le' });
        }

        if (currentStatus === nextStatus) {
            return res.json(toOrderDto(existing));
        }

        const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(nextStatus)) {
            return res.status(400).json({
                message: `Khong the chuyen trang thai tu ${currentStatus} sang ${nextStatus}`
            });
        }

        const updated = await OrderModel.findOneAndUpdate(
            { id: orderId },
            { $set: { status: nextStatus } },
            { new: true }
        ).lean();
        if (!updated) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }

        res.json(toOrderDto(updated));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/', checkLogin, async function (req, res) {
    try {
        const userId = Number(req.user.id);
        const docs = await OrderModel.find({ userId }).sort({ createdAt: -1 }).lean();
        res.json(docs.map(toOrderDto));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', checkLogin, async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const userId = Number(req.user.id);
        const doc = await OrderModel.findOne({ id: orderId, userId }).lean();
        if (!doc) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }
        res.json(toOrderDto(doc));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', checkLogin, async function (req, res) {
    const userId = Number(req.user.id);
    const rawItems = req.body.items;
    const shippingRaw =
        req.body.shippingAddress !== undefined ? req.body.shippingAddress : req.body.shipping_address;
    const shippingAddress =
        shippingRaw != null && String(shippingRaw).trim() !== '' ? String(shippingRaw).trim() : '';
    if (!shippingAddress) {
        return res.status(400).json({ message: 'Dia chi giao hang la bat buoc (shippingAddress)' });
    }

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
        return res.status(400).json({ message: 'Khong co dong don hop le' });
    }

    async function createOrderCore(sessionOrNull) {
        const resolvedRows = [];

        for (const [productId, quantity] of merged) {
            const baseFilter = activeProductFilter(productId);
            let findQuery = ProductModel.findOne(baseFilter);
            if (sessionOrNull) {
                findQuery = findQuery.session(sessionOrNull);
            }
            const prod = await findQuery.lean();
            if (!prod) {
                const err = new Error(`San pham ${productId} khong ton tai`);
                err.status = 400;
                throw err;
            }

            let row = prod;
            if (prod.stock != null) {
                if (prod.stock < quantity) {
                    const err = new Error(`San pham ${productId} khong du ton kho`);
                    err.status = 400;
                    throw err;
                }
                const updateOptions = sessionOrNull ? { new: true, session: sessionOrNull } : { new: true };
                const upd = await ProductModel.findOneAndUpdate(
                    { ...baseFilter, stock: { $gte: quantity } },
                    { $inc: { stock: -quantity } },
                    updateOptions
                ).lean();
                if (!upd) {
                    const err = new Error(`San pham ${productId} khong du ton kho`);
                    err.status = 400;
                    throw err;
                }
                row = upd;
            }

            resolvedRows.push({ productId, quantity, product: row });
        }

        const priced = await buildPricedOrderPayload(
            resolvedRows,
            userId,
            couponCode,
            sessionOrNull || null
        );
        const goodsAfterDiscount = priced.grandTotal;
        const shippingFee = computeShippingFee(goodsAfterDiscount);
        const totalPrice = goodsAfterDiscount + shippingFee;
        const orderNumericId = await nextSequentialId(OrderModel);

        const orderDoc = {
            id: orderNumericId,
            userId,
            subtotal: priced.subtotal,
            totalTax: priced.totalTax,
            discountTotal: priced.discountTotal,
            couponCode: priced.coupon ? priced.coupon.code : null,
            couponId: priced.coupon ? priced.coupon.id : null,
            shippingFee,
            totalPrice,
            status: 'PENDING',
            shippingAddress,
            items: priced.items
        };

        if (sessionOrNull) {
            await OrderModel.create([orderDoc], { session: sessionOrNull });
        } else {
            await OrderModel.create(orderDoc);
        }

        await createCouponRedemptionIfAny(sessionOrNull || null, priced.coupon, orderNumericId, userId);

        return orderNumericId;
    }

    let session = null;
    try {
        session = await mongoose.startSession();
        let createdOrderId = null;

        try {
            await session.withTransaction(async () => {
                createdOrderId = await createOrderCore(session);
            });
        } catch (txErr) {
            const msg = String(txErr && txErr.message ? txErr.message : '');
            const txUnsupported =
                msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
                msg.includes('does not support transactions');

            if (!txUnsupported) {
                throw txErr;
            }
            // Fallback for local standalone MongoDB (no replica set): continue without transaction.
            createdOrderId = await createOrderCore(null);
        }

        const created = await OrderModel.findOne({ id: createdOrderId }).lean();
        if (!created) {
            return res.status(500).json({ message: 'Khong lay duoc don hang sau khi tao' });
        }
        res.status(201).json(toOrderDto(created));
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ message: err.message });
    } finally {
        if (session) {
            session.endSession();
        }
    }
});

module.exports = router;
