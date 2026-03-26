const mongoose = require('mongoose');
const { nextSequentialId } = require('../utils/id');

const roleSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        name: { type: String, unique: true, required: true, trim: true },
        description: { type: String, default: null },
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

const RoleModel = mongoose.models.Role || mongoose.model('Role', roleSchema);

function stripDoc(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete o.__v;
    return o;
}

const notDeleted = { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] };

const Role = {
    async find(conditions = {}, options = {}) {
        const q = { ...conditions };
        if (!options.includeDeleted) {
            q.$and = [notDeleted];
        }
        const docs = await RoleModel.find(q).sort({ id: 1 }).lean();
        return docs.map(stripDoc);
    },

    async findById(id, options = {}) {
        const q = { id: Number(id) };
        if (!options.includeDeleted) {
            q.$and = [notDeleted];
        }
        const doc = await RoleModel.findOne(q).lean();
        return stripDoc(doc);
    },

    async create(data) {
        const id = await nextSequentialId(RoleModel);
        const doc = await RoleModel.create({
            ...data,
            id,
            name: String(data.name).trim().toUpperCase()
        });
        return stripDoc(doc.toObject());
    },

    async update(id, data) {
        const upd = { ...data };
        if (upd.name !== undefined) {
            upd.name = String(upd.name).trim().toUpperCase();
        }
        const doc = await RoleModel.findOneAndUpdate({ id: Number(id) }, { $set: upd }, { new: true }).lean();
        return stripDoc(doc);
    },

    async delete(id) {
        const doc = await RoleModel.findOneAndUpdate(
            { id: Number(id) },
            { $set: { isDeleted: true, deletedAt: new Date() } },
            { new: true }
        ).lean();
        return stripDoc(doc);
    }
};

module.exports = Role;
