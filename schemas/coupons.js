const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        code: { type: String, required: true, unique: true, uppercase: true, index: true },
        type: { type: String, enum: ['PERCENT', 'FIXED'], required: true },
        /** PERCENT: 0–100; FIXED: VND */
        value: { type: Number, required: true },
        minOrderAmount: { type: Number, default: 0 },
        maxDiscountAmount: { type: Number, default: null },
        validFrom: { type: Date, default: null },
        validTo: { type: Date, default: null },
        usageLimit: { type: Number, default: null },
        perUserLimit: { type: Number, default: null },
        active: { type: Boolean, default: true, index: true },
        excludedProductIds: { type: [Number], default: [] },
        /** Empty = all categories */
        applicableCategoryIds: { type: [Number], default: [] }
    },
    { timestamps: true }
);

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
