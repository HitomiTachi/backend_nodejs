const mongoose = require('mongoose');
const { nextSequentialId } = require('../utils/id');

const inventorySchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        product: { type: Number, unique: true, required: true, index: true },
        stock: { type: Number, min: 0, default: 0 },
        reserved: { type: Number, min: 0, default: 0 },
        soldCount: { type: Number, min: 0, default: 0 }
    },
    { timestamps: true }
);

const InventoryModel = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);

function stripDoc(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete o.__v;
    return o;
}

const Inventory = {
    async find(conditions = {}) {
        const docs = await InventoryModel.find(conditions).sort({ id: 1 }).lean();
        return docs.map(stripDoc);
    },

    async findById(id) {
        const doc = await InventoryModel.findOne({ id: Number(id) }).lean();
        return stripDoc(doc);
    },

    async findByProduct(productId) {
        const doc = await InventoryModel.findOne({ product: Number(productId) }).lean();
        return stripDoc(doc);
    },

    async ensureForProduct(productId) {
        const pid = Number(productId);
        const existed = await InventoryModel.findOne({ product: pid }).lean();
        if (existed) return stripDoc(existed);
        const id = await nextSequentialId(InventoryModel);
        const created = await InventoryModel.create({ id, product: pid, stock: 0, reserved: 0, soldCount: 0 });
        return stripDoc(created.toObject());
    },

    async addStock(productId, quantity) {
        const doc = await InventoryModel.findOneAndUpdate(
            { product: Number(productId) },
            { $inc: { stock: Number(quantity) } },
            { new: true }
        ).lean();
        return stripDoc(doc);
    },

    async removeStock(productId, quantity) {
        const qty = Number(quantity);
        const doc = await InventoryModel.findOneAndUpdate(
            { product: Number(productId), stock: { $gte: qty } },
            { $inc: { stock: -qty } },
            { new: true }
        ).lean();
        return stripDoc(doc);
    },

    async reserve(productId, quantity) {
        const qty = Number(quantity);
        const doc = await InventoryModel.findOneAndUpdate(
            { product: Number(productId), stock: { $gte: qty } },
            { $inc: { stock: -qty, reserved: qty } },
            { new: true }
        ).lean();
        return stripDoc(doc);
    },

    async sold(productId, quantity) {
        const qty = Number(quantity);
        const doc = await InventoryModel.findOneAndUpdate(
            { product: Number(productId), reserved: { $gte: qty } },
            { $inc: { reserved: -qty, soldCount: qty } },
            { new: true }
        ).lean();
        return stripDoc(doc);
    }
};

module.exports = Inventory;
