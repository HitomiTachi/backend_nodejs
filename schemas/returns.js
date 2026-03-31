const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema(
    {
        productId: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        reason: { type: String, default: null }
    },
    { _id: false }
);

const returnSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        orderId: { type: Number, required: true, index: true },
        userId: { type: Number, required: true, index: true },
        status: { type: String, default: 'REQUESTED', index: true },
        reason: { type: String, default: null },
        note: { type: String, default: null },
        items: [returnItemSchema],
        requestedAt: { type: Date, default: null },
        approvedAt: { type: Date, default: null },
        rejectedAt: { type: Date, default: null },
        receivedAt: { type: Date, default: null },
        closedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

returnSchema.index({ orderId: 1, createdAt: -1 });

module.exports = mongoose.models.Return || mongoose.model('Return', returnSchema);
