const mongoose = require('mongoose');

const couponRedemptionSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        couponId: { type: Number, required: true, index: true },
        userId: { type: Number, required: true, index: true },
        orderId: { type: Number, required: true, index: true }
    },
    { timestamps: true }
);

couponRedemptionSchema.index({ couponId: 1, userId: 1 });

module.exports =
    mongoose.models.CouponRedemption || mongoose.model('CouponRedemption', couponRedemptionSchema);
