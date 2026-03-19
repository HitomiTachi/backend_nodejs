const db = require('../utils/data');

const Product = {
    async find(conditions = {}) {
        const base = `
            SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
        `;
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            const [rows] = await db.query(base);
            return rows;
        }
        const where = keys.map(k => `p.\`${k}\` = ?`).join(' AND ');
        const values = keys.map(k => conditions[k]);
        const [rows] = await db.query(`${base} WHERE ${where}`, values);
        return rows;
    },

    async findOne(conditions) {
        const keys = Object.keys(conditions);
        const where = keys.map(k => `p.\`${k}\` = ?`).join(' AND ');
        const values = keys.map(k => conditions[k]);
        const [rows] = await db.query(
            `SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE ${where} LIMIT 1`,
            values
        );
        return rows[0] || null;
    },

    async findById(id) {
        const [rows] = await db.query(
            `SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ? LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    },

    async create(data) {
        const [result] = await db.query('INSERT INTO products SET ?', [data]);
        return await Product.findById(result.insertId);
    },

    async update(id, data) {
        await db.query('UPDATE products SET ? WHERE id = ?', [data, id]);
        return await Product.findById(id);
    },

    async delete(id) {
        const [result] = await db.query('DELETE FROM products WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
};

module.exports = Product;
