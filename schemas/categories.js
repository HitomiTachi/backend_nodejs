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
    /** Nhóm thuế logic (DEFAULT, ZERO, …). null → hệ thống dùng DEFAULT. */
    taxGroup: { type: String, default: null },
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

/**
 * Thứ tự hiển thị chuẩn: danh mục gốc (parent_id null) theo tên A–Z,
 * rồi từng nhóm con theo parent_id số, trong mỗi nhóm A–Z (tiếng Việt).
 * Khớp menu storefront khi client nhóm theo parent mà không sort lại từng cấp.
 */
function sortCategoryRowsVi(rows) {
    return [...rows].sort(function (a, b) {
        const aRoot = a.parent_id == null || a.parent_id === '';
        const bRoot = b.parent_id == null || b.parent_id === '';
        if (aRoot !== bRoot) {
            return aRoot ? -1 : 1;
        }
        if (!aRoot) {
            const diff = Number(a.parent_id) - Number(b.parent_id);
            if (diff !== 0) {
                return diff;
            }
        }
        return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
    });
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
        return sortCategoryRowsVi(docs.map(stripDoc));
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
