var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const OrderModel = require('../schemas/orders');
const OrderStatusHistoryModel = require('../schemas/orderStatusHistories');
const ShipmentModel = require('../schemas/shipments');
const ReturnModel = require('../schemas/returns');
const RefundModel = require('../schemas/refunds');
require('../schemas/products');
const ProductModel = mongoose.model('Product');
const { nextSequentialId } = require('../utils/id');
const { toOrderDto } = require('../utils/mappers/orderDto');
const {
    buildPricedOrderPayload,
    createCouponRedemptionIfAny
} = require('../services/orderPricing');
const { computeShippingFee } = require('../utils/shippingFee');
const { createMomoPayment, verifyMomoIpnSignature } = require('../utils/payment/momo');

function activeProductFilter(productId) {
    return {
        id: Number(productId),
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    };
}

const { mergeOrderItems } = require('../utils/mergeOrderItems');

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

function hasValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePageSize(pageRaw, sizeRaw) {
    const hasPage = hasValue(pageRaw);
    const hasSize = hasValue(sizeRaw);
    const page = hasPage ? Math.max(0, parseInt(String(pageRaw), 10)) : 0;
    const size = hasSize ? Math.min(200, Math.max(1, parseInt(String(sizeRaw), 10))) : 20;
    if ((hasPage && Number.isNaN(page)) || (hasSize && Number.isNaN(size))) {
        return { error: 'page/size khong hop le' };
    }
    return { page, size, hasPage, hasSize };
}

const REFUND_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    PAID: 'PAID',
    REJECTED: 'REJECTED'
};

const ALLOWED_REFUND_STATUS_TRANSITIONS = {
    [REFUND_STATUS.PENDING]: [REFUND_STATUS.APPROVED, REFUND_STATUS.REJECTED],
    [REFUND_STATUS.APPROVED]: [REFUND_STATUS.PAID],
    [REFUND_STATUS.PAID]: [],
    [REFUND_STATUS.REJECTED]: []
};

function normalizeRefundStatus(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
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

function buildMomoGatewayOrderId(orderId) {
    return `TH_${Number(orderId)}_${Date.now()}`;
}

function buildMomoRequestId(orderId, userId) {
    return `TH_REQ_${Number(orderId)}_${Number(userId)}_${Date.now()}`;
}

function encodeMomoExtraData(payload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function decodeMomoExtraData(value) {
    if (value == null || String(value).trim() === '') return null;
    try {
        const parsed = JSON.parse(Buffer.from(String(value), 'base64').toString('utf8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function summarizePaymentLog(orderLike) {
    if (!orderLike || typeof orderLike !== 'object') return {};
    return {
        orderId: orderLike.id != null ? Number(orderLike.id) : null,
        paymentStatus:
            orderLike.paymentStatus != null && String(orderLike.paymentStatus).trim() !== ''
                ? String(orderLike.paymentStatus).trim()
                : null,
        paymentMethod:
            orderLike.paymentMethod != null && String(orderLike.paymentMethod).trim() !== ''
                ? String(orderLike.paymentMethod).trim()
                : null,
        paymentGatewayOrderId:
            orderLike.paymentGatewayOrderId != null && String(orderLike.paymentGatewayOrderId).trim() !== ''
                ? String(orderLike.paymentGatewayOrderId).trim()
                : null
    };
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
        const parsed = parsePageSize(req.query.page, req.query.size);
        if (parsed.error) {
            return res.status(400).json({ message: parsed.error });
        }

        const statusRaw = req.query.status;
        const qRaw = req.query.q;
        const filter = { orderId };
        if (hasValue(statusRaw)) {
            const status = normalizeReturnStatus(statusRaw);
            if (!Object.prototype.hasOwnProperty.call(RETURN_STATUS, status)) {
                return res.status(400).json({ message: 'return status khong hop le' });
            }
            filter.status = status;
        }
        if (hasValue(qRaw)) {
            const q = String(qRaw).trim();
            const rx = new RegExp(escapeRegex(q), 'i');
            filter.$or = [{ reason: rx }, { note: rx }, { 'items.reason': rx }];
        }

        const [total, items] = await Promise.all([
            ReturnModel.countDocuments(filter),
            ReturnModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(parsed.page * parsed.size)
                .limit(parsed.size)
                .lean()
        ]);
        res.json({
            total,
            page: parsed.page,
            size: parsed.size,
            items
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/admin/:id/returns/:returnId', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
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
        res.json(row);
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

router.put('/admin/:id/returns/:returnId', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
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
        if (currentStatus !== RETURN_STATUS.REQUESTED) {
            return res.status(409).json({ message: 'Chi cho phep sua return o trang thai REQUESTED' });
        }

        const updateDoc = {
            reason: hasValue(req.body.reason) ? String(req.body.reason).trim() : row.reason || null,
            note: hasValue(req.body.note) ? String(req.body.note).trim() : row.note || null
        };
        if (Array.isArray(req.body.items) && req.body.items.length > 0) {
            const items = req.body.items
                .map((it) => ({
                    productId: Number(it.productId),
                    quantity: Number(it.quantity),
                    reason: hasValue(it.reason) ? String(it.reason).trim() : null
                }))
                .filter((it) => Number.isFinite(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);
            if (items.length === 0) {
                return res.status(400).json({ message: 'items khong hop le' });
            }
            updateDoc.items = items;
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

router.delete('/admin/:id/returns/:returnId', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
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
        const now = new Date();
        const updated = await ReturnModel.findOneAndUpdate(
            { id: returnId, orderId },
            {
                $set: {
                    status: RETURN_STATUS.CANCELLED,
                    closedAt: now,
                    note: hasValue(req.body && req.body.note) ? String(req.body.note).trim() : row.note || null
                }
            },
            { new: true }
        ).lean();
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/admin/:id/refunds', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const parsed = parsePageSize(req.query.page, req.query.size);
        if (parsed.error) {
            return res.status(400).json({ message: parsed.error });
        }

        const filter = { orderId };
        if (hasValue(req.query.status)) {
            const status = normalizeRefundStatus(req.query.status);
            if (!Object.prototype.hasOwnProperty.call(REFUND_STATUS, status)) {
                return res.status(400).json({ message: 'refund status khong hop le' });
            }
            filter.status = status;
        }
        if (hasValue(req.query.q)) {
            const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
            filter.$or = [{ method: rx }, { transactionRef: rx }, { note: rx }];
        }

        const [total, items] = await Promise.all([
            RefundModel.countDocuments(filter),
            RefundModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(parsed.page * parsed.size)
                .limit(parsed.size)
                .lean()
        ]);
        res.json({
            total,
            page: parsed.page,
            size: parsed.size,
            items
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/admin/:id/refunds', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const order = await OrderModel.findOne({ id: orderId }).lean();
        if (!order) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }

        const returnId = parseInt(String(req.body.returnId), 10);
        if (Number.isNaN(returnId)) {
            return res.status(400).json({ message: 'returnId khong hop le' });
        }
        const returnDoc = await ReturnModel.findOne({ id: returnId, orderId }).lean();
        if (!returnDoc) {
            return res.status(404).json({ message: 'Yeu cau tra hang khong ton tai' });
        }
        if (normalizeReturnStatus(returnDoc.status) !== RETURN_STATUS.RECEIVED) {
            return res.status(409).json({ message: 'Chi tao refund khi return o trang thai RECEIVED' });
        }

        // Security: never accept/store raw card details.
        const forbiddenKeys = ['cardNumber', 'cvv', 'cardCvv', 'card_number', 'card_cvv', 'expiry', 'expMonth', 'expYear'];
        for (const k of forbiddenKeys) {
            if (Object.prototype.hasOwnProperty.call(req.body, k)) {
                return res.status(400).json({ message: 'Khong duoc gui thong tin the/CVV' });
            }
        }

        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: 'amount khong hop le' });
        }
        const method = hasValue(req.body.method) ? String(req.body.method).trim() : null;
        if (!method) {
            return res.status(400).json({ message: 'method la bat buoc' });
        }

        const existed = await RefundModel.findOne({ orderId, returnId }).lean();
        if (existed) {
            return res.status(409).json({ message: 'Refund cho return nay da ton tai' });
        }

        const id = await nextSequentialId(RefundModel);
        const created = await RefundModel.create({
            id,
            orderId,
            returnId,
            status: REFUND_STATUS.PENDING,
            amount,
            currency: hasValue(req.body.currency) ? String(req.body.currency).trim().toUpperCase() : 'VND',
            method,
            transactionRef: hasValue(req.body.transactionRef) ? String(req.body.transactionRef).trim() : null,
            note: hasValue(req.body.note) ? String(req.body.note).trim() : null,
            createdByUserId: req.user && req.user.id ? Number(req.user.id) : null,
            meta: req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : null
        });
        res.status(201).json(created.toObject());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/admin/:id/refunds/:refundId/status', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        const refundId = parseInt(String(req.params.refundId), 10);
        if (Number.isNaN(orderId) || Number.isNaN(refundId)) {
            return res.status(400).json({ message: 'id refund/order khong hop le' });
        }

        const row = await RefundModel.findOne({ id: refundId, orderId }).lean();
        if (!row) {
            return res.status(404).json({ message: 'Refund khong ton tai' });
        }
        const currentStatus = normalizeRefundStatus(row.status);
        const nextStatus = normalizeRefundStatus(req.body.status);
        if (!Object.prototype.hasOwnProperty.call(REFUND_STATUS, nextStatus)) {
            return res.status(400).json({ message: 'refund status khong hop le' });
        }
        if (currentStatus === nextStatus) {
            return res.json(row);
        }
        const allowedNext = ALLOWED_REFUND_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(nextStatus)) {
            return res.status(400).json({
                message: `Khong the chuyen refund status tu ${currentStatus} sang ${nextStatus}`
            });
        }

        const now = new Date();
        const updateDoc = {
            status: nextStatus,
            note: hasValue(req.body.note) ? String(req.body.note).trim() : row.note || null,
            processedByUserId: req.user && req.user.id ? Number(req.user.id) : row.processedByUserId || null
        };
        if (nextStatus === REFUND_STATUS.APPROVED) updateDoc.approvedAt = now;
        if (nextStatus === REFUND_STATUS.REJECTED) updateDoc.rejectedAt = now;
        if (nextStatus === REFUND_STATUS.PAID) updateDoc.paidAt = now;
        if (hasValue(req.body.transactionRef)) {
            updateDoc.transactionRef = String(req.body.transactionRef).trim();
        }

        const updated = await RefundModel.findOneAndUpdate(
            { id: refundId, orderId },
            { $set: updateDoc },
            { new: true }
        ).lean();

        if (nextStatus === REFUND_STATUS.PAID) {
            await ReturnModel.findOneAndUpdate(
                { id: updated.returnId, orderId },
                {
                    $set: {
                        status: RETURN_STATUS.REFUNDED,
                        closedAt: now,
                        note: hasValue(req.body.note) ? String(req.body.note).trim() : 'Refund paid'
                    }
                },
                { new: false }
            ).lean();
        }

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
        if (nextStatus === ORDER_STATUS.DELIVERED && PAYMENT_REQUIRE_PAID_FOR_DELIVERED) {
            const paymentStatus = normalizePaymentStatus(existing.paymentStatus);
            if (paymentStatus !== PAYMENT_STATUS.PAID) {
                return res.status(409).json({
                    message: 'Khong the chuyen sang DELIVERED khi don chua PAID',
                    paymentStatus
                });
            }
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

router.post('/:id/payments/momo', checkLogin, async function (req, res) {
    try {
        const orderId = parseInt(String(req.params.id), 10);
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: 'id don hang khong hop le' });
        }
        const userId = Number(req.user && req.user.id);
        const order = await OrderModel.findOne({ id: orderId, userId }).lean();
        if (!order) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }
        const currentPaymentStatus = normalizePaymentStatus(order.paymentStatus);
        if (currentPaymentStatus === PAYMENT_STATUS.PAID) {
            return res.status(409).json({ message: 'Don hang da duoc thanh toan' });
        }

        const totalPrice = toFiniteNumber(order.totalPrice);
        if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
            return res.status(400).json({ message: 'Tong tien don hang khong hop le de thanh toan' });
        }

        const gatewayOrderId = buildMomoGatewayOrderId(order.id);
        const requestId = buildMomoRequestId(order.id, userId);
        const extraData = encodeMomoExtraData({
            internalOrderId: Number(order.id),
            userId,
            ts: Date.now()
        });
        console.info('[MOMO] create-payment:start', {
            orderId: Number(order.id),
            userId,
            gatewayOrderId,
            requestId
        });

        const { data } = await createMomoPayment({
            amount: String(Math.round(totalPrice)),
            gatewayOrderId,
            requestId,
            orderInfo: `Thanh toan don #${order.id}`,
            extraData
        });

        const resultCode = Number(data && data.resultCode);
        if (Number.isFinite(resultCode) && resultCode !== 0) {
            const failureMsg =
                data && data.message != null && String(data.message).trim() !== ''
                    ? String(data.message).trim()
                    : `MoMo tra resultCode ${resultCode}`;
            return res.status(502).json({ message: failureMsg, resultCode });
        }
        if (!data || !data.payUrl) {
            return res.status(502).json({ message: 'MoMo khong tra ve payUrl hop le' });
        }
        console.info('[MOMO] create-payment:response', {
            orderId: Number(order.id),
            requestId,
            gatewayOrderId,
            resultCode: Number(data.resultCode),
            hasPayUrl: Boolean(data.payUrl)
        });

        const paymentMeta = {
            payUrl: data.payUrl || null,
            deeplink: data.deeplink || null,
            qrCodeUrl: data.qrCodeUrl || null,
            orderType: data.orderType || null,
            responseTime: data.responseTime || null
        };
        const updated = await OrderModel.findOneAndUpdate(
            { id: orderId, userId },
            {
                $set: {
                    paymentMethod: 'MOMO',
                    paymentStatus: PAYMENT_STATUS.PENDING,
                    paymentGatewayOrderId: gatewayOrderId,
                    paymentRequestId: requestId,
                    paymentTransactionId: null,
                    paidAt: null,
                    paymentFailureReason: null,
                    paymentMeta
                }
            },
            { new: true }
        ).lean();
        if (!updated) {
            return res.status(404).json({ message: 'Don hang khong ton tai' });
        }
        console.info('[MOMO] create-payment:updated', summarizePaymentLog(updated));

        res.json({
            orderId: Number(updated.id),
            paymentMethod: updated.paymentMethod,
            paymentStatus: updated.paymentStatus,
            payUrl: paymentMeta.payUrl,
            deeplink: paymentMeta.deeplink,
            qrCodeUrl: paymentMeta.qrCodeUrl,
            requestId: updated.paymentRequestId,
            gatewayOrderId: updated.paymentGatewayOrderId
        });
    } catch (err) {
        console.warn('[MOMO] create-payment:error', {
            message: err && err.message ? String(err.message) : 'Unknown error',
            status: err && err.status ? Number(err.status) : 500
        });
        const status = err.status || 500;
        res.status(status).json({ message: err.message });
    }
});

router.get('/payments/momo/return', async function (req, res) {
    try {
        const gatewayOrderId =
            req.query && req.query.orderId != null && String(req.query.orderId).trim() !== ''
                ? String(req.query.orderId).trim()
                : null;
        const requestId =
            req.query && req.query.requestId != null && String(req.query.requestId).trim() !== ''
                ? String(req.query.requestId).trim()
                : null;
        const resultCode = req.query && req.query.resultCode != null ? Number(req.query.resultCode) : null;

        let order = null;
        if (gatewayOrderId) {
            order = await OrderModel.findOne({ paymentGatewayOrderId: gatewayOrderId }).lean();
        }
        if (!order && requestId) {
            order = await OrderModel.findOne({ paymentRequestId: requestId }).lean();
        }
        if (!order) {
            return res.status(404).json({
                message: 'Order not found for return params',
                paymentStatus: PAYMENT_STATUS.UNPAID,
                gatewayOrderId,
                requestId
            });
        }

        // Return URL is only for UX handoff; never finalize PAID from browser params.
        return res.json({
            message: 'Return received. Payment status must be confirmed by IPN.',
            order: summarizePaymentLog(order),
            requestId,
            gatewayOrderId,
            resultCode: Number.isFinite(resultCode) ? resultCode : null
        });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
});

router.post('/payments/momo/ipn', async function (req, res) {
    try {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        console.info('[MOMO] ipn:received', {
            orderId: payload.orderId != null ? String(payload.orderId) : null,
            requestId: payload.requestId != null ? String(payload.requestId) : null,
            resultCode: payload.resultCode != null ? Number(payload.resultCode) : null
        });
        const isSignatureValid = verifyMomoIpnSignature(payload);
        if (!isSignatureValid) {
            console.warn('[MOMO] ipn:invalid-signature', {
                orderId: payload.orderId != null ? String(payload.orderId) : null,
                requestId: payload.requestId != null ? String(payload.requestId) : null
            });
            return res.status(400).json({ resultCode: 97, message: 'Invalid signature' });
        }

        const gatewayOrderId =
            payload.orderId != null && String(payload.orderId).trim() !== '' ? String(payload.orderId).trim() : null;
        const extra = decodeMomoExtraData(payload.extraData);
        const internalOrderId =
            extra && Number.isFinite(Number(extra.internalOrderId)) ? Number(extra.internalOrderId) : null;

        let order = null;
        if (gatewayOrderId) {
            order = await OrderModel.findOne({ paymentGatewayOrderId: gatewayOrderId }).lean();
        }
        if (!order && internalOrderId != null) {
            order = await OrderModel.findOne({ id: internalOrderId }).lean();
        }
        if (!order) {
            return res.status(404).json({ resultCode: 1, message: 'Order not found' });
        }

        const currentPaymentStatus = normalizePaymentStatus(order.paymentStatus);
        if (currentPaymentStatus === PAYMENT_STATUS.PAID) {
            console.info('[MOMO] ipn:duplicate-paid', summarizePaymentLog(order));
            return res.json({ resultCode: 0, message: 'OK' });
        }

        const ipnAmount = toFiniteNumber(payload.amount);
        const orderAmount = toFiniteNumber(order.totalPrice);
        if (!Number.isFinite(ipnAmount) || !Number.isFinite(orderAmount) || Math.round(ipnAmount) !== Math.round(orderAmount)) {
            return res.status(400).json({ resultCode: 41, message: 'Amount mismatch' });
        }

        const ipnResultCode = Number(payload.resultCode);
        const isPaid = Number.isFinite(ipnResultCode) && ipnResultCode === 0;
        const nextStatus = isPaid
            ? PAYMENT_STATUS.PAID
            : ipnResultCode === 1006
                ? PAYMENT_STATUS.CANCELLED
                : PAYMENT_STATUS.FAILED;
        const failureReason =
            !isPaid && payload.message != null && String(payload.message).trim() !== ''
                ? String(payload.message).trim()
                : !isPaid
                    ? `MoMo resultCode ${ipnResultCode}`
                    : null;

        const updated = await OrderModel.findOneAndUpdate(
            { id: Number(order.id) },
            {
                $set: {
                    paymentMethod: 'MOMO',
                    paymentStatus: nextStatus,
                    paymentGatewayOrderId: gatewayOrderId || order.paymentGatewayOrderId || null,
                    paymentRequestId:
                        payload.requestId != null && String(payload.requestId).trim() !== ''
                            ? String(payload.requestId).trim()
                            : order.paymentRequestId || null,
                    paymentTransactionId:
                        payload.transId != null && String(payload.transId).trim() !== ''
                            ? String(payload.transId).trim()
                            : order.paymentTransactionId || null,
                    paidAt: isPaid ? new Date() : order.paidAt || null,
                    paymentFailureReason: failureReason,
                    paymentMeta: {
                        ...(order.paymentMeta && typeof order.paymentMeta === 'object' ? order.paymentMeta : {}),
                        lastIpn: {
                            requestId:
                                payload.requestId != null && String(payload.requestId).trim() !== ''
                                    ? String(payload.requestId).trim()
                                    : null,
                            resultCode: Number.isFinite(ipnResultCode) ? ipnResultCode : null,
                            message:
                                payload.message != null && String(payload.message).trim() !== ''
                                    ? String(payload.message).trim()
                                    : null,
                            transId:
                                payload.transId != null && String(payload.transId).trim() !== ''
                                    ? String(payload.transId).trim()
                                    : null,
                            receivedAt: new Date().toISOString()
                        }
                    }
                }
            },
            { new: true }
        ).lean();

        if (!updated) {
            return res.status(404).json({ resultCode: 1, message: 'Order not found' });
        }
        console.info('[MOMO] ipn:status-updated', {
            from: currentPaymentStatus,
            to: nextStatus,
            ...summarizePaymentLog(updated)
        });
        return res.json({ resultCode: 0, message: 'OK' });
    } catch (err) {
        console.warn('[MOMO] ipn:error', {
            message: err && err.message ? String(err.message) : 'Unknown error',
            status: err && err.status ? Number(err.status) : 500
        });
        const status = err.status || 500;
        return res.status(status).json({ resultCode: 99, message: err.message || 'Internal error' });
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
