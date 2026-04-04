const mongoose = require('mongoose');
const userController = require('../controllers/users');

require('../schemas/users');
const UserModel = mongoose.models.User;

function normalizeRole(role) {
    return String(role || '')
        .trim()
        .toUpperCase();
}

function isStaffRole(role) {
    const r = normalizeRole(role);
    return r === 'ADMIN' || r === 'MODERATOR';
}

/**
 * Admin nhận tin hỗ trợ: SUPPORT_ADMIN_USER_ID hoặc user role ADMIN đầu tiên (id nhỏ nhất).
 */
async function resolveSupportAdminUserId() {
    const envRaw = process.env.SUPPORT_ADMIN_USER_ID;
    const envId = parseInt(String(envRaw != null ? envRaw : '').trim(), 10);
    if (!Number.isNaN(envId) && envId >= 1) {
        const u = await userController.FindById(envId);
        if (u && isStaffRole(u.role)) {
            return envId;
        }
    }
    const doc = await UserModel.findOne({
        role: { $in: ['ADMIN', 'MODERATOR'] },
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    })
        .sort({ id: 1 })
        .select('id')
        .lean();
    return doc && doc.id != null ? Number(doc.id) : null;
}

module.exports = {
    normalizeRole,
    isStaffRole,
    resolveSupportAdminUserId
};
