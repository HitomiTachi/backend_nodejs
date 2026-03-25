const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
    {
        productId: { type: Number, required: true },
        productName: { type: String, required: true },
        productImage: { type: String, default: null },
        quantity: { type: Number, required: true },
        priceAtOrder: { type: Number, required: true }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        userId: { type: Number, required: true, index: true },
        totalPrice: { type: Number, required: true },
        status: { type: String, default: 'PENDING' },
        items: [orderItemSchema]
    },
    { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
