const mongoose = require('mongoose');

const orderStatusHistorySchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        orderId: { type: Number, required: true, index: true },
        fromStatus: { type: String, default: null },
        toStatus: { type: String, required: true, index: true },
        changedByUserId: { type: Number, default: null, index: true },
        note: { type: String, default: null }
    },
    { timestamps: true }
);

orderStatusHistorySchema.index({ orderId: 1, createdAt: -1 });

module.exports =
    mongoose.models.OrderStatusHistory || mongoose.model('OrderStatusHistory', orderStatusHistorySchema);
