var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const OrderModel = require('../schemas/orders');
const OrderStatusHistoryModel = require('../schemas/orderStatusHistories');
const ShipmentModel = require('../schemas/shipments');
const ReturnModel = require('../schemas/returns');
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
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: []
};

function normalizeOrderStatus(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

const SHIPMENT_STATUS = {
    PENDING: 'PENDING',
    SHIPPED: 'SHIPPED',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
    RETURNED: 'RETURNED',
    CANCELLED: 'CANCELLED'
};

function normalizeShipmentStatus(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

function parseOptionalDate(value) {
    if (value == null || String(value).trim() === '') return null;
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
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

const RETURN_STATUS = {
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    RECEIVED: 'RECEIVED',
    REFUNDED: 'REFUNDED',
    CANCELLED: 'CANCELLED'
};

const ALLOWED_RETURN_STATUS_TRANSITIONS = {
    [RETURN_STATUS.REQUESTED]: [RETURN_STATUS.APPROVED, RETURN_STATUS.REJECTED, RETURN_STATUS.CANCELLED],
    [RETURN_STATUS.APPROVED]: [RETURN_STATUS.RECEIVED, RETURN_STATUS.CANCELLED],
    [RETURN_STATUS.REJECTED]: [],
    [RETURN_STATUS.RECEIVED]: [RETURN_STATUS.REFUNDED],
    [RETURN_STATUS.REFUNDED]: [],
    [RETURN_STATUS.CANCELLED]: []
};

function normalizeReturnStatus(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
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

router.get('/admin/:id/shipment', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const row = await ShipmentModel.findOne({ orderId }).lean();
        if (!row) {
            return res.status(404).json({ message: 'Van don chua ton tai' });
        }
        res.json(row);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/admin/:id/returns', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const rows = await ReturnModel.find({ orderId }).sort({ createdAt: -1 }).lean();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/admin/:id/returns', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const order = await OrderModel.findOne({ id: orderId }).lean();
        if (!order) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }

        const itemsRaw = Array.isArray(req.body.items) ? req.body.items : [];
        if (itemsRaw.length === 0) {
            return res.status(400).json({ message: 'items phai la mang khong rong' });
        }
        const items = itemsRaw
            .map((it) => ({
                productId: Number(it.productId),
                quantity: Number(it.quantity),
                reason: it.reason != null && String(it.reason).trim() !== '' ? String(it.reason).trim() : null
            }))
            .filter((it) => Number.isFinite(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);
        if (items.length === 0) {
            return res.status(400).json({ message: 'items khong hop le' });
        }

        const id = await nextSequentialId(ReturnModel);
        const created = await ReturnModel.create({
            id,
            orderId,
            userId: Number(order.userId),
            status: RETURN_STATUS.REQUESTED,
            reason: req.body.reason != null && String(req.body.reason).trim() !== '' ? String(req.body.reason).trim() : null,
            note: req.body.note != null && String(req.body.note).trim() !== '' ? String(req.body.note).trim() : null,
            items,
            requestedAt: new Date()
        });
        res.status(201).json(created.toObject());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/admin/:id/returns/:returnId/status', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        const returnId = parseInt(String(req.params.returnId), 10);
        if (Number.isNaN(orderId) || Number.isNaN(returnId)) {
            return res.status(400).json({ message: 'id return/order khong hop le' });
        }

        const row = await ReturnModel.findOne({ id: returnId, orderId }).lean();
        if (!row) {
            return res.status(404).json({ message: 'Yeu cau tra hang khong ton tai' });
        }

        const currentStatus = normalizeReturnStatus(row.status);
        const nextStatus = normalizeReturnStatus(req.body.status);
        if (!Object.prototype.hasOwnProperty.call(RETURN_STATUS, nextStatus)) {
            return res.status(400).json({ message: 'return status khong hop le' });
        }
        if (currentStatus === nextStatus) {
            return res.json(row);
        }
        const allowedNext = ALLOWED_RETURN_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(nextStatus)) {
            return res.status(400).json({
                message: `Khong the chuyen return status tu ${currentStatus} sang ${nextStatus}`
            });
        }

        const now = new Date();
        const updateDoc = {
            status: nextStatus,
            note: req.body.note != null && String(req.body.note).trim() !== '' ? String(req.body.note).trim() : row.note
        };
        if (nextStatus === RETURN_STATUS.APPROVED) updateDoc.approvedAt = now;
        if (nextStatus === RETURN_STATUS.REJECTED) updateDoc.rejectedAt = now;
        if (nextStatus === RETURN_STATUS.RECEIVED) updateDoc.receivedAt = now;
        if (
            nextStatus === RETURN_STATUS.REFUNDED ||
            nextStatus === RETURN_STATUS.CANCELLED ||
            nextStatus === RETURN_STATUS.REJECTED
        ) {
            updateDoc.closedAt = now;
        }

        const updated = await ReturnModel.findOneAndUpdate(
            { id: returnId, orderId },
            { $set: updateDoc },
            { new: true }
        ).lean();
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/admin/:id/shipment', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }

        const order = await OrderModel.findOne({ id: orderId }).lean();
        if (!order) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }

        const statusRaw = req.body.status;
        const nextShipmentStatus =
            statusRaw == null || String(statusRaw).trim() === ''
                ? SHIPMENT_STATUS.PENDING
                : normalizeShipmentStatus(statusRaw);
        if (!Object.prototype.hasOwnProperty.call(SHIPMENT_STATUS, nextShipmentStatus)) {
            return res.status(400).json({ message: 'shipment status khong hop le' });
        }

        const shippedAt = parseOptionalDate(req.body.shippedAt);
        const estimatedDeliveryAt = parseOptionalDate(req.body.estimatedDeliveryAt);
        const deliveredAt = parseOptionalDate(req.body.deliveredAt);
        if (req.body.shippedAt && !shippedAt) {
            return res.status(400).json({ message: 'shippedAt khong hop le' });
        }
        if (req.body.estimatedDeliveryAt && !estimatedDeliveryAt) {
            return res.status(400).json({ message: 'estimatedDeliveryAt khong hop le' });
        }
        if (req.body.deliveredAt && !deliveredAt) {
            return res.status(400).json({ message: 'deliveredAt khong hop le' });
        }

        const updateDoc = {
            carrier:
                req.body.carrier != null && String(req.body.carrier).trim() !== ''
                    ? String(req.body.carrier).trim()
                    : null,
            trackingNumber:
                req.body.trackingNumber != null && String(req.body.trackingNumber).trim() !== ''
                    ? String(req.body.trackingNumber).trim()
                    : null,
            status: nextShipmentStatus,
            shippedAt,
            estimatedDeliveryAt,
            deliveredAt,
            note:
                req.body.note != null && String(req.body.note).trim() !== ''
                    ? String(req.body.note).trim()
                    : null
        };

        const current = await ShipmentModel.findOne({ orderId }).lean();
        if (current) {
            const updated = await ShipmentModel.findOneAndUpdate({ orderId }, { $set: updateDoc }, { new: true }).lean();
            return res.json(updated);
        }

        const id = await nextSequentialId(ShipmentModel);
        const created = await ShipmentModel.create({
            id,
            orderId,
            ...updateDoc
        });
        return res.status(201).json(created.toObject());
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

        if (nextStatus === ORDER_STATUS.CANCELLED) {
            await restoreProductStockForOrder(existing);
        }

        const updated = await OrderModel.findOneAndUpdate(
            { id: orderId },
            { $set: { status: nextStatus } },
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
