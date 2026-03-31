const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        orderId: { type: Number, required: true, index: true },
        returnId: { type: Number, required: true, index: true },
        status: { type: String, default: 'PENDING', index: true },
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'VND' },
        method: { type: String, required: true },
        transactionRef: { type: String, default: null, index: true },
        note: { type: String, default: null },
        createdByUserId: { type: Number, default: null, index: true },
        processedByUserId: { type: Number, default: null, index: true },
        approvedAt: { type: Date, default: null },
        paidAt: { type: Date, default: null },
        rejectedAt: { type: Date, default: null },
        meta: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    { timestamps: true }
);

refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ returnId: 1 }, { unique: true });

module.exports = mongoose.models.Refund || mongoose.model('Refund', refundSchema);
