const CouponModel = require('../schemas/coupons');

/**
 * Đặt active=false cho mọi voucher có validTo < hiện tại (vẫn đang active).
 * Gọi trước khi admin xem danh sách / chi tiết và khi khách áp mã (checkout).
 */
async function deactivateExpiredCoupons() {
    const now = new Date();
    await CouponModel.updateMany(
        {
            active: true,
            validTo: { $exists: true, $ne: null, $lt: now }
        },
        { $set: { active: false } }
    );
}

module.exports = { deactivateExpiredCoupons };
