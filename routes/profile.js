var express = require('express');
var router = express.Router();
const { checkLogin } = require('../utils/authHandler');
const userController = require('../controllers/users');
const { toProfileDto } = require('../utils/mappers/profileDto');
const { createAvatarPresignedPut } = require('../utils/avatarStorage');
const { normalizeAvatarForDb } = require('../utils/avatarUrlPolicy');
const crypto = require('crypto');

const MAX_SAVED_ADDRESSES = 20;
const MAX_ADDR_LINE = 800;
const MAX_ADDR_LABEL = 120;
const MAX_RNAME = 120;
const MAX_RPHONE = 30;
const MAX_STREET = 200;
const MAX_WARD = 80;
const MAX_DIST = 80;
const MAX_PROV = 80;
const MAX_NOTE = 300;

function pickField(row, camel, snake) {
    if (row[camel] !== undefined && row[camel] !== null) return row[camel];
    if (snake && row[snake] !== undefined && row[snake] !== null) return row[snake];
    return undefined;
}

function trimSlice(v, max) {
    if (v == null) return '';
    return String(v).trim().slice(0, max);
}

function composeLineFromParts(parts) {
    const name = parts.recipientName.trim();
    const phone = parts.recipientPhone.trim();
    const street = parts.street.trim();
    const ward = parts.ward.trim();
    const district = parts.district.trim();
    const province = parts.province.trim();
    const note = parts.note.trim();
    const lines = [];
    const who = [name, phone].filter(Boolean).join(' · ');
    if (who) lines.push(who);
    const loc = [street, ward, district, province].filter(Boolean).join(', ');
    if (loc) lines.push(loc);
    if (note) lines.push(`Ghi chú: ${note}`);
    return lines.join('\n').trim();
}

function normalizeSavedAddressesInput(body) {
    const raw =
        body.savedAddresses !== undefined
            ? body.savedAddresses
            : body.saved_addresses !== undefined
              ? body.saved_addresses
              : undefined;
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) {
        throw new Error('savedAddresses phai la mang');
    }
    const out = [];
    for (let i = 0; i < raw.length && out.length < MAX_SAVED_ADDRESSES; i++) {
        const row = raw[i];
        if (!row || typeof row !== 'object') continue;
        let id = row.id != null ? String(row.id).trim() : '';
        if (!id) {
            id = `a_${crypto.randomBytes(8).toString('hex')}`;
        }
        const label = row.label != null ? String(row.label).trim().slice(0, MAX_ADDR_LABEL) : '';
        const recipientName = trimSlice(pickField(row, 'recipientName', 'recipient_name'), MAX_RNAME);
        const recipientPhone = trimSlice(pickField(row, 'recipientPhone', 'recipient_phone'), MAX_RPHONE);
        const street = trimSlice(pickField(row, 'street', 'street'), MAX_STREET);
        const ward = trimSlice(pickField(row, 'ward', 'ward'), MAX_WARD);
        const district = trimSlice(pickField(row, 'district', 'district'), MAX_DIST);
        const province = trimSlice(pickField(row, 'province', 'province'), MAX_PROV);
        const note = trimSlice(pickField(row, 'note', 'note'), MAX_NOTE);
        let explicit = row.line != null ? String(row.line).trim().slice(0, MAX_ADDR_LINE) : '';
        const composed = composeLineFromParts({
            recipientName,
            recipientPhone,
            street,
            ward,
            district,
            province,
            note
        });
        const hasStructured = !!(recipientName || recipientPhone || street || ward || district || province || note);
        let line = '';
        if (explicit.length >= 8) {
            line = explicit;
        } else if (composed.length >= 8) {
            line = composed.slice(0, MAX_ADDR_LINE);
        } else if (explicit.length >= 4) {
            line = explicit;
        } else if (hasStructured && composed.length >= 4) {
            line = composed.slice(0, MAX_ADDR_LINE);
        }
        if (line.length < 4) continue;
        const doc = { id, label, line };
        if (recipientName) doc.recipientName = recipientName;
        if (recipientPhone) doc.recipientPhone = recipientPhone;
        if (street) doc.street = street;
        if (ward) doc.ward = ward;
        if (district) doc.district = district;
        if (province) doc.province = province;
        if (note) doc.note = note;
        out.push(doc);
    }
    return out;
}

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

    let savedNorm;
    try {
        savedNorm = normalizeSavedAddressesInput(body);
    } catch (e) {
        const err = new Error(e && e.message ? e.message : 'savedAddresses khong hop le');
        err.statusCode = 400;
        throw err;
    }
    if (savedNorm !== undefined) {
        updateData.saved_addresses = savedNorm;
    }

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
        const code = err && err.statusCode === 400 ? 400 : 500;
        res.status(code).json({ message: err.message });
    }
});

module.exports = router;
