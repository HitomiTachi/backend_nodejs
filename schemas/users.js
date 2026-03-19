const db = require('../utils/data');
const bcrypt = require('bcrypt');

const User = {
    async findById(id) {
        const [rows] = await db.query(
            'SELECT id, name, email, password_changed_at, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
            [id]
        );
        return rows[0] || null;
    },

    async findByIdWithPassword(id) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE id = ? LIMIT 1',
            [id]
        );
        return rows[0] || null;
    },

    async findOne(conditions) {
        const keys = Object.keys(conditions);
        const where = keys.map(k => `\`${k}\` = ?`).join(' AND ');
        const values = keys.map(k => conditions[k]);
        const [rows] = await db.query(
            `SELECT * FROM users WHERE ${where} LIMIT 1`,
            values
        );
        return rows[0] || null;
    },

    async find(conditions = {}) {
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            const [rows] = await db.query(
                'SELECT id, name, email, password_changed_at, created_at, updated_at FROM users'
            );
            return rows;
        }
        const where = keys.map(k => `\`${k}\` = ?`).join(' AND ');
        const values = keys.map(k => conditions[k]);
        const [rows] = await db.query(
            `SELECT id, name, email, password_changed_at, created_at, updated_at FROM users WHERE ${where}`,
            values
        );
        return rows;
    },

    async create(data) {
        if (data.password_hash) {
            const salt = bcrypt.genSaltSync(10);
            data.password_hash = bcrypt.hashSync(data.password_hash, salt);
        }
        const [result] = await db.query('INSERT INTO users SET ?', [data]);
        return await User.findById(result.insertId);
    },

    async update(id, data) {
        if (data.password_hash) {
            const salt = bcrypt.genSaltSync(10);
            data.password_hash = bcrypt.hashSync(data.password_hash, salt);
        }
        await db.query('UPDATE users SET ? WHERE id = ?', [data, id]);
        return await User.findById(id);
    },

    async delete(id) {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
};

module.exports = User;
