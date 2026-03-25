var express = require('express');
var router = express.Router();
const { checkLogin } = require('../utils/authHandler');
const CartModel = require('../schemas/carts');
const Product = require('../schemas/products');
const { effectiveUnitPrice, getCartItemsForUser } = require('../utils/mappers/cartDto');

function parseProductId(value) {
    const n = parseInt(String(value), 10);
    return Number.isNaN(n) ? null : n;
}

function normalizeVariant(body) {
    if (body == null || body.variant === undefined || body.variant === null) return null;
    const s = String(body.variant).trim();
    return s === '' ? null : s;
}

async function ensureStock(product, quantity, message) {
    if (product.stock == null) return null;
    if (quantity > product.stock) {
        const err = new Error(message || 'Khong du ton kho');
        err.status = 400;
        throw err;
    }
    return null;
}

/**
 * Thêm dòng — giá/tên từ DB; client gửi name/price/image chỉ để UI (bỏ qua khi có sản phẩm).
 */
async function addCartLine(userId, body) {
    const productId = parseProductId(body.productId != null ? body.productId : body.product_id);
    if (productId == null) {
        const err = new Error('productId khong hop le');
        err.status = 400;
        throw err;
    }
    const addQty = Math.max(1, parseInt(String(body.quantity != null ? body.quantity : 1), 10) || 1);
    const variant = normalizeVariant(body);

    const product = await Product.findById(productId, { publicOnly: true });
    if (!product) {
        const err = new Error('San pham khong ton tai');
        err.status = 400;
        throw err;
    }

    let cart = await CartModel.findOne({ userId: Number(userId) });
    if (!cart) {
        await ensureStock(product, addQty);
        const unit = effectiveUnitPrice(product);
        cart = await CartModel.create({
            userId: Number(userId),
            items: [
                {
                    productId,
                    quantity: addQty,
                    variant,
                    price: unit,
                    name: product.name,
                    image: product.image || ''
                }
            ]
        });
        return cart;
    }

    let found = false;
    for (let i = 0; i < cart.items.length; i++) {
        const it = cart.items[i];
        if (Number(it.productId) === productId && String(it.variant || '') === String(variant || '')) {
            const nextQty = Number(it.quantity) + addQty;
            await ensureStock(product, nextQty);
            it.quantity = nextQty;
            it.price = effectiveUnitPrice(product);
            it.name = product.name;
            it.image = product.image || '';
            found = true;
            break;
        }
    }
    if (!found) {
        await ensureStock(product, addQty);
        const unit = effectiveUnitPrice(product);
        cart.items.push({
            productId,
            quantity: addQty,
            variant,
            price: unit,
            name: product.name,
            image: product.image || ''
        });
    }
    await cart.save();
    return cart;
}

async function mergePutItems(rawItems) {
    const merged = new Map();
    for (const line of rawItems) {
        const productId = parseProductId(line.productId);
        if (productId == null) {
            const err = new Error('productId khong hop le');
            err.status = 400;
            throw err;
        }
        const variant = normalizeVariant(line);
        const q = Math.max(0, parseInt(String(line.quantity), 10) || 0);
        if (q <= 0) continue;
        const key = JSON.stringify([productId, variant]);
        merged.set(key, (merged.get(key) || 0) + q);
    }
    const newLines = [];
    for (const [key, quantity] of merged) {
        const [productId, variant] = JSON.parse(key);
        const product = await Product.findById(productId, { publicOnly: true });
        if (!product) {
            const err = new Error(`San pham ${productId} khong ton tai`);
            err.status = 400;
            throw err;
        }
        await ensureStock(product, quantity);
        const unit = effectiveUnitPrice(product);
        newLines.push({
            productId,
            quantity,
            variant,
            price: unit,
            name: product.name,
            image: product.image || ''
        });
    }
    return newLines;
}

router.get('/', checkLogin, async function (req, res) {
    try {
        const items = await getCartItemsForUser(req.user.id);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

/** PUT /cart — replace toàn bộ (docs §4.2) */
router.put('/', checkLogin, async function (req, res) {
    try {
        const rawItems = req.body.items;
        if (!Array.isArray(rawItems)) {
            return res.status(400).json({ message: 'items phai la mang' });
        }
        const userId = req.user.id;
        const newLines = await mergePutItems(rawItems);
        await CartModel.findOneAndUpdate(
            { userId: Number(userId) },
            { $set: { items: newLines } },
            { upsert: true, new: true }
        );
        const items = await getCartItemsForUser(userId);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

/** POST /cart/items — spec §5.6 */
router.post('/items', checkLogin, async function (req, res) {
    try {
        await addCartLine(req.user.id, req.body);
        const items = await getCartItemsForUser(req.user.id);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

/** PATCH /cart/items/:id */
router.patch('/items/:id', checkLogin, async function (req, res) {
    try {
        const userId = req.user.id;
        const quantity = parseInt(String(req.body.quantity), 10);
        if (Number.isNaN(quantity)) {
            return res.status(400).json({ message: 'quantity khong hop le' });
        }
        const cart = await CartModel.findOne({ userId: Number(userId) });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        const sub = cart.items.id(req.params.id);
        if (!sub) {
            return res.status(404).json({ message: 'Item not found' });
        }
        if (quantity <= 0) {
            sub.deleteOne();
        } else {
            const product = await Product.findById(sub.productId, { publicOnly: true });
            if (product) {
                await ensureStock(product, quantity);
            } else if (sub.price == null) {
                return res.status(400).json({ message: 'Khong cap nhat duoc ton kho' });
            }
            sub.quantity = quantity;
            if (product) {
                sub.price = effectiveUnitPrice(product);
                sub.name = product.name;
                sub.image = product.image || '';
            }
        }
        await cart.save();
        const items = await getCartItemsForUser(userId);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

/** DELETE /cart/items/:id */
router.delete('/items/:id', checkLogin, async function (req, res) {
    try {
        const userId = req.user.id;
        const cart = await CartModel.findOne({ userId: Number(userId) });
        if (!cart) {
            const items = await getCartItemsForUser(userId);
            return res.json(items);
        }
        const sub = cart.items.id(req.params.id);
        if (sub) {
            sub.deleteOne();
            await cart.save();
        }
        const items = await getCartItemsForUser(userId);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

/** Legacy: POST /cart — body product_id, … */
router.post('/', checkLogin, async function (req, res) {
    try {
        await addCartLine(req.user.id, req.body);
        const items = await getCartItemsForUser(req.user.id);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

/** Legacy: PUT /cart/:itemId */
router.put('/:itemId', checkLogin, async function (req, res) {
    try {
        const userId = req.user.id;
        const quantity = parseInt(String(req.body.quantity), 10);
        if (Number.isNaN(quantity)) {
            return res.status(400).json({ message: 'quantity khong hop le' });
        }
        const cart = await CartModel.findOne({ userId: Number(userId) });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        const sub = cart.items.id(req.params.itemId);
        if (!sub) {
            return res.status(404).json({ message: 'Item not found' });
        }
        if (quantity <= 0) {
            sub.deleteOne();
        } else {
            const product = await Product.findById(sub.productId, { publicOnly: true });
            if (product) {
                await ensureStock(product, quantity);
            }
            sub.quantity = quantity;
            if (product) {
                sub.price = effectiveUnitPrice(product);
                sub.name = product.name;
                sub.image = product.image || '';
            }
        }
        await cart.save();
        const items = await getCartItemsForUser(userId);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

/** Legacy: DELETE /cart/:itemId */
router.delete('/:itemId', checkLogin, async function (req, res) {
    try {
        const userId = req.user.id;
        const cart = await CartModel.findOne({ userId: Number(userId) });
        if (!cart) {
            const items = await getCartItemsForUser(userId);
            return res.json(items);
        }
        const sub = cart.items.id(req.params.itemId);
        if (sub) {
            sub.deleteOne();
            await cart.save();
        }
        const items = await getCartItemsForUser(userId);
        res.json(items);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
});

module.exports = router;
