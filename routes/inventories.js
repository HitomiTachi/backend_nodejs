var express = require('express');
var router = express.Router();
const Inventory = require('../schemas/inventories');
const InventoryIdempotency = require('../schemas/inventory_idempotencies');
const Product = require('../schemas/products');
const { checkLogin, CheckPermission } = require('../utils/authHandler');

function toInventoryDto(row, product) {
    const dto = {
        id: row.id,
        product: row.product,
        stock: row.stock,
        reserved: row.reserved,
        soldCount: row.soldCount
    };
    if (product) {
        dto.productData = product;
    }
    return dto;
}

function readProductAndQuantity(body) {
    const product = Number(body.product);
    const quantity = Number(body.quantity);
    return { product, quantity };
}

function readIdempotencyKey(req) {
    const h = req.headers['idempotency-key'];
    if (h && String(h).trim() !== '') return String(h).trim();
    if (req.body && req.body.idempotencyKey && String(req.body.idempotencyKey).trim() !== '') {
        return String(req.body.idempotencyKey).trim();
    }
    return '';
}

async function ensureProductExists(productId) {
    const product = await Product.findById(productId, { publicOnly: false });
    return product;
}

async function beginIdempotency(action, key, product, quantity, res) {
    const existed = await InventoryIdempotency.findByActionAndKey(action, key);
    if (existed) {
        if (Number(existed.product) !== Number(product) || Number(existed.quantity) !== Number(quantity)) {
            res.status(409).json({ message: 'Idempotency key da duoc dung voi payload khac' });
            return null;
        }
        if (existed.status === 'COMPLETED' && existed.response) {
            res.json({ ...existed.response, idempotentReplay: true });
            return null;
        }
        res.status(409).json({ message: 'Idempotency key dang duoc xu ly' });
        return null;
    }
    try {
        return await InventoryIdempotency.createPending(action, key, product, quantity);
    } catch (error) {
        const raceExisted = await InventoryIdempotency.findByActionAndKey(action, key);
        if (raceExisted && raceExisted.status === 'COMPLETED' && raceExisted.response) {
            res.json({ ...raceExisted.response, idempotentReplay: true });
            return null;
        }
        res.status(409).json({ message: 'Idempotency key dang duoc xu ly' });
        return null;
    }
}

router.get('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const items = await Inventory.find();
        res.json(items.map((e) => toInventoryDto(e)));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/idempotency/:action/:key', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const action = String(req.params.action || '').trim().toLowerCase();
        if (action !== 'reservation' && action !== 'sold') {
            return res.status(400).json({ message: 'action khong hop le' });
        }
        const key = String(req.params.key || '').trim();
        if (!key) return res.status(400).json({ message: 'key khong hop le' });
        const record = await InventoryIdempotency.findByActionAndKey(action, key);
        if (!record) return res.status(404).json({ message: 'IDEMPOTENCY NOT FOUND' });
        return res.json(record);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
});

router.get('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'ID NOT FOUND' });
        const product = await Product.findById(item.product, { publicOnly: false });
        res.json(toInventoryDto(item, product));
    } catch (error) {
        res.status(404).json({ message: 'ID NOT FOUND' });
    }
});

router.post('/add-stock', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const { product, quantity } = readProductAndQuantity(req.body);
        if (!Number.isFinite(product) || !Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'product va quantity phai hop le' });
        }
        const existedProduct = await ensureProductExists(product);
        if (!existedProduct) return res.status(404).json({ message: 'PRODUCT NOT FOUND' });
        await Inventory.ensureForProduct(product);
        const updated = await Inventory.addStock(product, quantity);
        res.json(toInventoryDto(updated));
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.post('/remove-stock', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const { product, quantity } = readProductAndQuantity(req.body);
        if (!Number.isFinite(product) || !Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'product va quantity phai hop le' });
        }
        const existedProduct = await ensureProductExists(product);
        if (!existedProduct) return res.status(404).json({ message: 'PRODUCT NOT FOUND' });
        await Inventory.ensureForProduct(product);
        const updated = await Inventory.removeStock(product, quantity);
        if (!updated) return res.status(400).json({ message: 'Khong du stock de tru' });
        res.json(toInventoryDto(updated));
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.post('/reservation', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    let idemKey = '';
    let lockAcquired = false;
    try {
        const { product, quantity } = readProductAndQuantity(req.body);
        idemKey = readIdempotencyKey(req);
        if (!Number.isFinite(product) || !Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'product va quantity phai hop le' });
        }
        if (!idemKey) {
            return res.status(400).json({ message: 'Idempotency-Key la bat buoc cho reservation' });
        }
        const lock = await beginIdempotency('reservation', idemKey, product, quantity, res);
        if (!lock) return;
        lockAcquired = true;
        const existedProduct = await ensureProductExists(product);
        if (!existedProduct) {
            await InventoryIdempotency.remove('reservation', idemKey);
            return res.status(404).json({ message: 'PRODUCT NOT FOUND' });
        }
        await Inventory.ensureForProduct(product);
        const updated = await Inventory.reserve(product, quantity);
        if (!updated) {
            await InventoryIdempotency.remove('reservation', idemKey);
            return res.status(400).json({ message: 'Khong du stock de reservation' });
        }
        const payload = toInventoryDto(updated);
        await InventoryIdempotency.markCompleted('reservation', idemKey, payload);
        res.json(payload);
    } catch (error) {
        if (idemKey && lockAcquired) await InventoryIdempotency.remove('reservation', idemKey);
        res.status(400).json({ message: error.message });
    }
});

router.post('/sold', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    let idemKey = '';
    let lockAcquired = false;
    try {
        const { product, quantity } = readProductAndQuantity(req.body);
        idemKey = readIdempotencyKey(req);
        if (!Number.isFinite(product) || !Number.isFinite(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'product va quantity phai hop le' });
        }
        if (!idemKey) {
            return res.status(400).json({ message: 'Idempotency-Key la bat buoc cho sold' });
        }
        const lock = await beginIdempotency('sold', idemKey, product, quantity, res);
        if (!lock) return;
        lockAcquired = true;
        const existedProduct = await ensureProductExists(product);
        if (!existedProduct) {
            await InventoryIdempotency.remove('sold', idemKey);
            return res.status(404).json({ message: 'PRODUCT NOT FOUND' });
        }
        await Inventory.ensureForProduct(product);
        const updated = await Inventory.sold(product, quantity);
        if (!updated) {
            await InventoryIdempotency.remove('sold', idemKey);
            return res.status(400).json({ message: 'Khong du reserved de ghi nhan sold' });
        }
        const payload = toInventoryDto(updated);
        await InventoryIdempotency.markCompleted('sold', idemKey, payload);
        res.json(payload);
    } catch (error) {
        if (idemKey && lockAcquired) await InventoryIdempotency.remove('sold', idemKey);
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
