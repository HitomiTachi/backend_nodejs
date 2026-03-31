const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        orderId: { type: Number, required: true, unique: true, index: true },
        carrier: { type: String, default: null },
        trackingNumber: { type: String, default: null, index: true },
        status: { type: String, default: 'PENDING', index: true },
        shippedAt: { type: Date, default: null },
        estimatedDeliveryAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        note: { type: String, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.models.Shipment || mongoose.model('Shipment', shipmentSchema);
