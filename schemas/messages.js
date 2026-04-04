const mongoose = require('mongoose');

const messageContentSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ['text', 'file'], required: true },
        text: { type: String, default: '' }
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        fromUserId: { type: Number, required: true, index: true },
        toUserId: { type: Number, required: true, index: true },
        messageContent: { type: messageContentSchema, required: true },
        /** GENERAL | PRODUCT_FEEDBACK — góp ý / báo lỗi sản phẩm */
        contextType: {
            type: String,
            enum: ['GENERAL', 'PRODUCT_FEEDBACK'],
            default: 'GENERAL'
        },
        productId: { type: Number, default: null, index: true },
        productNameSnapshot: { type: String, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
