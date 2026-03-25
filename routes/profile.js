var express = require('express');
var router = express.Router();
const { checkLogin } = require('../utils/authHandler');
const userController = require('../controllers/users');
const { toProfileDto } = require('../utils/mappers/profileDto');

function pickProfileUpdate(body) {
    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.gender !== undefined) updateData.gender = body.gender;

    const dob = body.dateOfBirth !== undefined ? body.dateOfBirth : body.date_of_birth;
    if (dob !== undefined) {
        updateData.date_of_birth = dob === null || dob === '' ? null : new Date(dob);
    }

    const addr = body.defaultAddress !== undefined ? body.defaultAddress : body.default_address;
    if (addr !== undefined) updateData.default_address = addr;

    const avatar = body.avatarUrl !== undefined ? body.avatarUrl : body.avatar_url;
    if (avatar !== undefined) updateData.avatar_url = avatar;

    return updateData;
}

router.get('/', checkLogin, async function (req, res, next) {
    try {
        const userId = req.user.id;
        const row = await userController.FindById(userId);
        if (!row) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(toProfileDto(row));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/', checkLogin, async function (req, res, next) {
    try {
        const userId = req.user.id;
        const updateData = pickProfileUpdate(req.body);

        if (Object.keys(updateData).length > 0) {
            await userController.UpdateUser(userId, updateData);
        }

        const row = await userController.FindById(userId);
        res.json(toProfileDto(row));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
