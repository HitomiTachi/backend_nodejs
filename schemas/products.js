const mongoose = require('mongoose');
const { nextSequentialId } = require('../utils/id');
const Category = require('./categories');
const { escapeRegex } = require('../utils/mappers/catalogDto');

const colorSchema = new mongoose.Schema(
    {
        name: String,
        hex: String
    },
    { _id: false }
);

const productSchema = new mongoose.Schema({
    id: { type: Number, unique: true, index: true },
    name: String,
    slug: { type: String, index: true },
    price: Number,
    category_id: Number,
    description: String,
    image: String,
    images: [String],
    sku: String,
    old_price: Number,
    salePrice: Number,
    stock: Number,
    tag: String,
    is_best_seller: Boolean,
    featured: { type: Boolean, default: false },
    specifications: String,
    colors: [colorSchema],
    storageOptions: [String],
    isDeleted: { type: Boolean, default: false }
});

const ProductModel = mongoose.models.Product || mongoose.model('Product', productSchema);

function stripDoc(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete o.__v;
    return o;
}

function notDeletedFilter() {
    return { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] };
}

async function enrichProduct(row) {
    if (!row) return null;
    const o = stripDoc(row);
    const cat = await Category.findById(o.category_id);
    o.category_name = cat ? cat.name : null;
    o.category_slug = cat ? cat.slug : null;
    o.category_icon = cat ? cat.icon : null;
    return o;
}

const Product = {
    async find(conditions = {}) {
        const q = { ...conditions };
        if (q.featured === 1) q.featured = true;
        const docs = await ProductModel.find(q).lean();
        const out = [];
        for (const d of docs) {
            out.push(await enrichProduct(d));
        }
        return out;
    },

    /**
     * Storefront list: filter category_id, search name, pagination. Bỏ sản phẩm soft-delete.
     */
    async findCatalog(params) {
        const categoryId = params.categoryId;
        const qText = params.q != null ? String(params.q).trim() : '';
        const pageRaw = params.page;
        const sizeRaw = params.size;

        const filter = { $and: [notDeletedFilter()] };
        if (categoryId != null && categoryId !== '') {
            filter.$and.push({ category_id: Number(categoryId) });
        }
        if (qText) {
            filter.$and.push({ name: { $regex: new RegExp(escapeRegex(qText), 'i') } });
        }

        const hasPage = pageRaw !== null && pageRaw !== undefined && pageRaw !== '';
        const hasSize = sizeRaw !== null && sizeRaw !== undefined && sizeRaw !== '';
        let queryBuilder = ProductModel.find(filter).sort({ id: 1 });
        if (hasPage && hasSize) {
            const pageNum = Math.max(0, parseInt(pageRaw, 10));
            const sizeNum = Math.min(200, Math.max(1, parseInt(sizeRaw, 10)));
            queryBuilder = queryBuilder.skip(pageNum * sizeNum).limit(sizeNum);
        }

        const docs = await queryBuilder.lean();
        const out = [];
        for (const d of docs) {
            out.push(await enrichProduct(d));
        }
        return out;
    },

    async findFeatured() {
        const filter = {
            featured: true,
            $and: [notDeletedFilter()]
        };
        const docs = await ProductModel.find(filter).sort({ id: 1 }).lean();
        const out = [];
        for (const d of docs) {
            out.push(await enrichProduct(d));
        }
        return out;
    },

    async findOne(conditions) {
        const q = { ...conditions };
        if (q.featured === 1) q.featured = true;
        const doc = await ProductModel.findOne(q).lean();
        return enrichProduct(doc);
    },

    async findById(id, options) {
        const publicOnly = options && options.publicOnly;
        const doc = await ProductModel.findOne({ id: Number(id) }).lean();
        if (!doc) return null;
        if (publicOnly && doc.isDeleted === true) return null;
        return enrichProduct(doc);
    },

    async create(data) {
        const id = await nextSequentialId(ProductModel);
        const doc = await ProductModel.create({ ...data, id });
        return enrichProduct(doc.toObject());
    },

    async update(id, data) {
        const doc = await ProductModel.findOneAndUpdate({ id: Number(id) }, { $set: data }, { new: true }).lean();
        return enrichProduct(doc);
    },

    async delete(id) {
        const r = await ProductModel.deleteOne({ id: Number(id) });
        return r.deletedCount > 0;
    }
};

module.exports = Product;
