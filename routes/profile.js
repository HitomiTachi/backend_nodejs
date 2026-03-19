var express = require('express');
var router = express.Router();
const { checkLogin } = require('../utils/authHandler');
const db = require('../utils/data');

// Lấy profile của user đang đăng nhập
router.get('/', checkLogin, async function (req, res, next) {
    try {
        const userId = req.user.id;
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.created_at,
                    p.phone, p.gender, p.date_of_birth, p.default_address, p.avatar_url
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = ? LIMIT 1`,
            [userId]
        );
        if (!rows.length) return res.status(404).send({ message: 'User not found' });
        res.send(rows[0]);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Cập nhật profile
router.put('/', checkLogin, async function (req, res, next) {
    try {
        const userId = req.user.id;
        const { name, phone, gender, date_of_birth, default_address, avatar_url } = req.body;

        if (name) {
            await db.query('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
        }

        const profileData = {};
        if (phone !== undefined) profileData.phone = phone;
        if (gender !== undefined) profileData.gender = gender;
        if (date_of_birth !== undefined) profileData.date_of_birth = date_of_birth;
        if (default_address !== undefined) profileData.default_address = default_address;
        if (avatar_url !== undefined) profileData.avatar_url = avatar_url;

        if (Object.keys(profileData).length > 0) {
            const [existing] = await db.query('SELECT id FROM profiles WHERE user_id = ?', [userId]);
            if (existing.length) {
                await db.query('UPDATE profiles SET ? WHERE user_id = ?', [profileData, userId]);
            } else {
                profileData.user_id = userId;
                await db.query('INSERT INTO profiles SET ?', [profileData]);
            }
        }

        const [rows] = await db.query(
            `SELECT u.id, u.name, u.email, u.created_at,
                    p.phone, p.gender, p.date_of_birth, p.default_address, p.avatar_url
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = ? LIMIT 1`,
            [userId]
        );
        res.send(rows[0]);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

module.exports = router;
