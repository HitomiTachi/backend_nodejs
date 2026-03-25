const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
    {
        productId: { type: Number, required: true },
        variant: { type: String, default: null },
        quantity: { type: Number, default: 1 },
        /** Snapshot tại lúc thêm — dùng khi sản phẩm không còn trong catalog */
        price: Number,
        name: String,
        image: String
    },
    { _id: true }
);

const cartSchema = new mongoose.Schema({
    userId: { type: Number, unique: true, index: true, required: true },
    items: [cartItemSchema]
});

module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
