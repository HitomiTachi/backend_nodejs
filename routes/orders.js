var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
const { checkLogin } = require('../utils/authHandler');
const OrderModel = require('../schemas/orders');
require('../schemas/products');
const ProductModel = mongoose.model('Product');
const { nextSequentialId } = require('../utils/id');
const { effectiveUnitPrice } = require('../utils/mappers/cartDto');
const { toOrderDto } = require('../utils/mappers/orderDto');

function activeProductFilter(productId) {
    return {
        id: Number(productId),
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    };
}

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
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return res.status(400).json({ message: 'items phai la mang khong rong' });
    }

    const merged = mergeOrderItems(rawItems);
    if (merged.size === 0) {
        return res.status(400).json({ message: 'Khong co dong don hop le' });
    }

    const session = await mongoose.startSession();
    let orderNumericId;

    try {
        let lineItems = [];
        let totalPrice = 0;

        await session.withTransaction(async () => {
            lineItems = [];
            totalPrice = 0;

            for (const [productId, quantity] of merged) {
                const baseFilter = activeProductFilter(productId);
                const prod = await ProductModel.findOne(baseFilter).session(session).lean();
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
                    const upd = await ProductModel.findOneAndUpdate(
                        { ...baseFilter, stock: { $gte: quantity } },
                        { $inc: { stock: -quantity } },
                        { new: true, session }
                    ).lean();
                    if (!upd) {
                        const err = new Error(`San pham ${productId} khong du ton kho`);
                        err.status = 400;
                        throw err;
                    }
                    row = upd;
                }

                const unit = effectiveUnitPrice(row);
                totalPrice += unit * quantity;
                lineItems.push({
                    productId,
                    productName: row.name || '',
                    productImage: row.image != null ? row.image : null,
                    quantity,
                    priceAtOrder: unit
                });
            }

            orderNumericId = await nextSequentialId(OrderModel);
            await OrderModel.create(
                [
                    {
                        id: orderNumericId,
                        userId,
                        totalPrice,
                        status: 'PENDING',
                        items: lineItems
                    }
                ],
                { session }
            );
        });

        const created = await OrderModel.findOne({ id: orderNumericId }).lean();
        if (!created) {
            return res.status(500).json({ message: 'Khong lay duoc don hang sau khi tao' });
        }
        res.status(201).json(toOrderDto(created));
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ message: err.message });
    } finally {
        session.endSession();
    }
});

module.exports = router;
