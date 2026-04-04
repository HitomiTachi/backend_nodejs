var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const OrderModel = require('../schemas/orders');
const OrderStatusHistoryModel = require('../schemas/orderStatusHistories');
require('../schemas/products');
require('../schemas/users');
const ProductModel = mongoose.model('Product');
const UserModel = mongoose.model('User');
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
const CartModel = require('../schemas/carts');

const PAYMENT_STATUS = {
    UNPAID: 'UNPAID',
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED'
};

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
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: []
};

function parseBoolEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || String(raw).trim() === '') return fallback;
    const v = String(raw).trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
    return fallback;
}

const PAYMENT_REQUIRE_PAID_FOR_DELIVERED = parseBoolEnv('PAYMENT_REQUIRE_PAID_FOR_DELIVERED', false);

function normalizeOrderStatus(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

async function restoreProductStockForOrder(orderDoc) {
    if (!orderDoc || !Array.isArray(orderDoc.items) || orderDoc.items.length === 0) return;
    for (const item of orderDoc.items) {
        const productId = Number(item && item.productId);
        const quantity = Number(item && item.quantity);
        if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) {
            continue;
        }
        await ProductModel.findOneAndUpdate(
            { id: productId },
            { $inc: { stock: quantity } },
            { new: false }
        ).lean();
    }
}

function normalizePaymentStatus(value) {
    const normalized = String(value || '')
        .trim()
        .toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(PAYMENT_STATUS, normalized)) {
        return PAYMENT_STATUS.UNPAID;
    }
    return normalized;
}

function isValidPaymentStatus(value) {
    const normalized = String(value || '')
        .trim()
        .toUpperCase();
    return Object.prototype.hasOwnProperty.call(PAYMENT_STATUS, normalized);
}

/** COD: thanh toán xảy ra khi giao — khi DELIVERED coi như đã thu tiền. */
function isCodPaymentMethod(value) {
    const u = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
    return u === 'COD' || u === 'CASH_ON_DELIVERY';
}

async function appendOrderStatusHistory(orderId, fromStatus, toStatus, changedByUserId, note) {
    const historyId = await nextSequentialId(OrderStatusHistoryModel);
    await OrderStatusHistoryModel.create({
        id: historyId,
        orderId: Number(orderId),
        fromStatus: fromStatus ? normalizeOrderStatus(fromStatus) : null,
        toStatus: normalizeOrderStatus(toStatus),
        changedByUserId: changedByUserId != null ? Number(changedByUserId) : null,
        note: note != null && String(note).trim() !== '' ? String(note).trim() : null
    });
}

router.get('/admin', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const pageRaw = req.query.page;
        const sizeRaw = req.query.size;
        const statusRaw = req.query.status;
        const paymentStatusRaw = req.query.paymentStatus;
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
        if (paymentStatusRaw != null && String(paymentStatusRaw).trim() !== '') {
            if (!isValidPaymentStatus(paymentStatusRaw)) {
                return res.status(400).json({ message: 'paymentStatus khong hop le' });
            }
            filter.paymentStatus = String(paymentStatusRaw).trim().toUpperCase();
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

        const userIds = [...new Set(docs.map((d) => Number(d.userId)).filter((id) => Number.isFinite(id)))];
        let userById = {};
        if (userIds.length && UserModel) {
            const users = await UserModel.find({ id: { $in: userIds } })
                .select('id name email')
                .lean();
            userById = Object.fromEntries(
                users.map((u) => {
                    const label = String(u.name || '').trim() || String(u.email || '').trim() || '';
                    return [u.id, label];
                })
            );
        }

        res.json({
            total,
            page,
            size,
            items: docs.map((doc) => {
                const dto = toOrderDto(doc);
                const uid = Number(doc.userId);
                if (Number.isFinite(uid) && userById[uid]) {
                    dto.userName = userById[uid];
                }
                return dto;
            })
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
        const dto = toOrderDto(doc);
        const uid = Number(doc.userId);
        if (Number.isFinite(uid) && UserModel) {
            const u = await UserModel.findOne({ id: uid }).select('id name email').lean();
            if (u) {
                dto.userName = String(u.name || '').trim() || String(u.email || '').trim() || null;
            }
        }
        res.json(dto);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/admin/:id/status-history', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const rows = await OrderStatusHistoryModel.find({ orderId }).sort({ createdAt: -1 }).lean();
        res.json(
            rows.map((row) => ({
                id: row.id,
                orderId: row.orderId,
                fromStatus: row.fromStatus,
                toStatus: row.toStatus,
                changedByUserId: row.changedByUserId,
                note: row.note,
                createdAt: row.createdAt
            }))
        );
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

        const noteRaw = req.body.note;
        const note = noteRaw != null && String(noteRaw).trim() !== '' ? String(noteRaw).trim() : null;
        if (nextStatus === ORDER_STATUS.CANCELLED && !note) {
            return res.status(400).json({ message: 'Vui long nhap ly do huy don (note)' });
        }
        if (nextStatus === ORDER_STATUS.DELIVERED && PAYMENT_REQUIRE_PAID_FOR_DELIVERED) {
            const cod = isCodPaymentMethod(existing.paymentMethod);
            if (!cod) {
                const paymentStatus = normalizePaymentStatus(existing.paymentStatus);
                if (paymentStatus !== PAYMENT_STATUS.PAID) {
                    return res.status(409).json({
                        message: 'Khong the chuyen sang DELIVERED khi don chua PAID',
                        paymentStatus
                    });
                }
            }
        }

        if (nextStatus === ORDER_STATUS.CANCELLED) {
            await restoreProductStockForOrder(existing);
        }

        const statusUpdate = { status: nextStatus };
        if (nextStatus === ORDER_STATUS.DELIVERED && isCodPaymentMethod(existing.paymentMethod)) {
            const ps = normalizePaymentStatus(existing.paymentStatus);
            if (ps === PAYMENT_STATUS.UNPAID || ps === PAYMENT_STATUS.PENDING) {
                statusUpdate.paymentStatus = PAYMENT_STATUS.PAID;
                statusUpdate.paidAt = new Date();
            }
        }

        const updated = await OrderModel.findOneAndUpdate(
            { id: orderId },
            { $set: statusUpdate },
            { new: true }
        ).lean();
        if (!updated) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }

        await appendOrderStatusHistory(
            orderId,
            currentStatus,
            nextStatus,
            req.user && req.user.id,
            note || `Transition ${currentStatus} -> ${nextStatus}`
        );

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
            discountTotal: priced.discountTotal,
            couponCode: priced.coupon ? priced.coupon.code : null,
            couponId: priced.coupon ? priced.coupon.id : null,
            shippingFee,
            totalPrice,
            status: 'PENDING',
            paymentMethod: 'COD',
            paymentStatus: PAYMENT_STATUS.UNPAID,
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
        try {
            await CartModel.findOneAndUpdate({ userId: Number(userId) }, { $set: { items: [] } });
        } catch {
            /* giỏ DB lỗi không chặn phản hồi đơn đã tạo */
        }
        await appendOrderStatusHistory(created.id, null, created.status, req.user && req.user.id, 'Order created');
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
