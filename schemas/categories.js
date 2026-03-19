const db = require('../utils/data');

const Category = {
    async find(conditions = {}) {
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            const [rows] = await db.query('SELECT * FROM categories');
            return rows;
        }
        const where = keys.map(k => `\`${k}\` = ?`).join(' AND ');
        const values = keys.map(k => conditions[k]);
        const [rows] = await db.query(`SELECT * FROM categories WHERE ${where}`, values);
        return rows;
    },

    async findOne(conditions) {
        const keys = Object.keys(conditions);
        const where = keys.map(k => `\`${k}\` = ?`).join(' AND ');
        const values = keys.map(k => conditions[k]);
        const [rows] = await db.query(
            `SELECT * FROM categories WHERE ${where} LIMIT 1`,
            values
        );
        return rows[0] || null;
    },

    async findById(id) {
        const [rows] = await db.query(
            'SELECT * FROM categories WHERE id = ? LIMIT 1',
            [id]
        );
        return rows[0] || null;
    },

    async create(data) {
        const [result] = await db.query('INSERT INTO categories SET ?', [data]);
        return await Category.findById(result.insertId);
    },

    async update(id, data) {
        await db.query('UPDATE categories SET ? WHERE id = ?', [data, id]);
        return await Category.findById(id);
    },

    async delete(id) {
        const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
};

module.exports = Category;
