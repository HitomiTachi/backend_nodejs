var express = require('express');
var router = express.Router();
const { checkLogin } = require('../utils/authHandler');
const userController = require('../controllers/users');
const { toProfileDto } = require('../utils/mappers/profileDto');
const { createAvatarPresignedPut } = require('../utils/avatarStorage');
const { normalizeAvatarForDb } = require('../utils/avatarUrlPolicy');

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

/** POST /profile/avatar/presign — JSON { contentType, fileSize? } → presigned PUT + publicUrl (CDN). */
router.post('/avatar/presign', checkLogin, async function (req, res) {
    try {
        const userId = req.user.id;
        const contentType = req.body.contentType !== undefined ? req.body.contentType : req.body.content_type;
        const fileSizeRaw = req.body.fileSize !== undefined ? req.body.fileSize : req.body.file_size;
        const fileSize = fileSizeRaw !== undefined && fileSizeRaw !== null ? Number(fileSizeRaw) : undefined;

        const result = await createAvatarPresignedPut({
            userId,
            contentType,
            fileSize
        });
        res.json(result);
    } catch (err) {
        if (err.code === 'NOT_CONFIGURED') {
            return res.status(503).json({ message: err.message, code: 'AVATAR_STORAGE_NOT_CONFIGURED' });
        }
        if (err.code === 'VALIDATION') {
            return res.status(400).json({ message: err.message, code: err.message });
        }
        res.status(500).json({ message: err.message });
    }
});

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

        if (updateData.avatar_url !== undefined) {
            try {
                updateData.avatar_url = normalizeAvatarForDb(updateData.avatar_url);
            } catch (e) {
                return res.status(400).json({ message: e.message, code: e.code || 'VALIDATION' });
            }
        }

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
