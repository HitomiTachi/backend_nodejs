const mongoose = require('mongoose');
const { nextSequentialId } = require('../utils/id');

const categorySchema = new mongoose.Schema({
    id: { type: Number, unique: true, index: true },
    name: String,
    slug: { type: String, unique: true, index: true },
    /**
     * parent_id defines category hierarchy (parent/child).
     * - null: top-level (danh mục cha)
     * - number: child category (danh mục con) referencing categories.id
     */
    parent_id: { type: Number, default: null, index: true },
    icon: String,
    /** URL ảnh đại diện danh mục (storefront / menu); tuỳ chọn */
    imageUrl: String,
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Number, default: null }
});

const CategoryModel = mongoose.models.Category || mongoose.model('Category', categorySchema);

function stripDoc(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete o.__v;
    return o;
}

const Category = {
    async find(conditions = {}) {
        const q = Object.keys(conditions).length ? conditions : {};
        const includeDeleted = !!q.includeDeleted;
        if (q.includeDeleted !== undefined) delete q.includeDeleted;
        if (!includeDeleted) {
            q.$and = [{ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }];
        }
        const docs = await CategoryModel.find(q).lean();
        return docs.map(stripDoc);
    },

    async findOne(conditions) {
        const q = { ...conditions };
        const includeDeleted = !!q.includeDeleted;
        if (q.includeDeleted !== undefined) delete q.includeDeleted;
        if (!includeDeleted) {
            q.$and = [{ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }];
        }
        const doc = await CategoryModel.findOne(q).lean();
        return stripDoc(doc);
    },

    async findById(id, options = {}) {
        const q = { id: Number(id) };
        if (!options.includeDeleted) {
            q.$and = [{ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }];
        }
        const doc = await CategoryModel.findOne(q).lean();
        return stripDoc(doc);
    },

    /** Trùng slug với bản ghi khác (dùng khi PUT đổi tên). */
    async findOneBySlugExcludingId(slug, excludeNumericId) {
        const doc = await CategoryModel.findOne({
            slug,
            id: { $ne: Number(excludeNumericId) }
        }).lean();
        return stripDoc(doc);
    },

    async create(data) {
        const id = await nextSequentialId(CategoryModel);
        const doc = await CategoryModel.create({ ...data, id });
        return stripDoc(doc.toObject());
    },

    async update(id, data) {
        const doc = await CategoryModel.findOneAndUpdate({ id: Number(id) }, { $set: data }, { new: true }).lean();
        return stripDoc(doc);
    },

    async delete(id, deletedBy) {
        const doc = await CategoryModel.findOneAndUpdate(
            { id: Number(id) },
            { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy || null } },
            { new: true }
        ).lean();
        return !!doc;
    }
};

module.exports = Category;
