const mongoose = require('mongoose');

const inventoryIdempotencySchema = new mongoose.Schema(
    {
        action: { type: String, required: true, enum: ['reservation', 'sold'], index: true },
        key: { type: String, required: true, index: true },
        product: { type: Number, required: true },
        quantity: { type: Number, required: true },
        status: { type: String, required: true, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
        response: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    { timestamps: true }
);

inventoryIdempotencySchema.index({ action: 1, key: 1 }, { unique: true });

const InventoryIdempotencyModel =
    mongoose.models.InventoryIdempotency || mongoose.model('InventoryIdempotency', inventoryIdempotencySchema);

function stripDoc(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete o.__v;
    return o;
}

const InventoryIdempotency = {
    async findByActionAndKey(action, key) {
        const doc = await InventoryIdempotencyModel.findOne({ action, key }).lean();
        return stripDoc(doc);
    },

    async createPending(action, key, product, quantity) {
        const doc = await InventoryIdempotencyModel.create({
            action,
            key,
            product: Number(product),
            quantity: Number(quantity),
            status: 'PENDING'
        });
        return stripDoc(doc.toObject());
    },

    async markCompleted(action, key, response) {
        const doc = await InventoryIdempotencyModel.findOneAndUpdate(
            { action, key },
            { $set: { status: 'COMPLETED', response } },
            { new: true }
        ).lean();
        return stripDoc(doc);
    },

    async remove(action, key) {
        await InventoryIdempotencyModel.deleteOne({ action, key });
    }
};

module.exports = InventoryIdempotency;
