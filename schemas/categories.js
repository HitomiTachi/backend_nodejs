const mongoose = require('mongoose');
const { nextSequentialId } = require('../utils/id');

const categorySchema = new mongoose.Schema({
    id: { type: Number, unique: true, index: true },
    name: String,
    slug: { type: String, unique: true, index: true },
    icon: String,
    /** URL ảnh đại diện danh mục (storefront / menu); tuỳ chọn */
    imageUrl: String
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
        const docs = await CategoryModel.find(q).lean();
        return docs.map(stripDoc);
    },

    async findOne(conditions) {
        const doc = await CategoryModel.findOne(conditions).lean();
        return stripDoc(doc);
    },

    async findById(id) {
        const doc = await CategoryModel.findOne({ id: Number(id) }).lean();
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

    async delete(id) {
        const r = await CategoryModel.deleteOne({ id: Number(id) });
        return r.deletedCount > 0;
    }
};

module.exports = Category;
