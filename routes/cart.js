var express = require('express');
var router = express.Router();
const { checkLogin } = require('../utils/authHandler');
const db = require('../utils/data');

// Lấy giỏ hàng của user đang đăng nhập
router.get('/', checkLogin, async function (req, res, next) {
    try {
        const userId = req.user.id;
        const [carts] = await db.query('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
        if (!carts.length) {
            return res.send({ id: null, user_id: userId, items: [] });
        }
        const cart = carts[0];
        const [items] = await db.query(
            `SELECT ci.*, p.name, p.image, p.slug
             FROM cart_items ci
             LEFT JOIN products p ON ci.product_id = p.id
             WHERE ci.cart_id = ?`,
            [cart.id]
        );
        res.send({ ...cart, items });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Thêm sản phẩm vào giỏ
router.post('/', checkLogin, async function (req, res, next) {
    try {
        const userId = req.user.id;
        const { product_id, quantity = 1, variant, price } = req.body;

        let [carts] = await db.query('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
        let cartId;
        if (!carts.length) {
            const [result] = await db.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
            cartId = result.insertId;
        } else {
            cartId = carts[0].id;
        }

        const [existing] = await db.query(
            'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND (variant = ? OR (variant IS NULL AND ? IS NULL)) LIMIT 1',
            [cartId, product_id, variant || null, variant || null]
        );

        if (existing.length) {
            await db.query(
                'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
                [quantity, existing[0].id]
            );
        } else {
            await db.query(
                'INSERT INTO cart_items (cart_id, product_id, variant, quantity, price) VALUES (?, ?, ?, ?, ?)',
                [cartId, product_id, variant || null, quantity, price]
            );
        }

        const [items] = await db.query(
            `SELECT ci.*, p.name, p.image, p.slug
             FROM cart_items ci
             LEFT JOIN products p ON ci.product_id = p.id
             WHERE ci.cart_id = ?`,
            [cartId]
        );
        res.send({ cart_id: cartId, items });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Cập nhật số lượng item trong giỏ
router.put('/:itemId', checkLogin, async function (req, res, next) {
    try {
        const { quantity } = req.body;
        if (quantity <= 0) {
            await db.query('DELETE FROM cart_items WHERE id = ?', [req.params.itemId]);
        } else {
            await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, req.params.itemId]);
        }
        res.send({ message: 'updated' });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Xóa item khỏi giỏ
router.delete('/:itemId', checkLogin, async function (req, res, next) {
    try {
        await db.query('DELETE FROM cart_items WHERE id = ?', [req.params.itemId]);
        res.send({ message: 'removed' });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

module.exports = router;
