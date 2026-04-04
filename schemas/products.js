const mongoose = require('mongoose');
const { nextSequentialId } = require('../utils/id');
const Category = require('./categories');
const { escapeRegex } = require('../utils/mappers/catalogDto');
const { enrichProductSpecs } = require('../utils/productSpecsEnricher');
const { normalizeSku } = require('../utils/sku');

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
    sku: {
        type: String,
        required: true,
        maxlength: 64,
        unique: true,
        set(v) {
            if (v == null) return '';
            return String(v).trim().toUpperCase();
        }
    },
    old_price: Number,
    salePrice: Number,
    stock: Number,
    tag: String,
    is_best_seller: Boolean,
    featured: { type: Boolean, default: false },
    specifications: String,
    colors: [colorSchema],
    storageOptions: [String],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Number, default: null }
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
     * Map storefront `sort` query → Mongoose sort object. Unknown values fall back to id ascending.
     */
    _catalogSort(sortRaw) {
        const s = sortRaw != null ? String(sortRaw).trim().toLowerCase() : '';
        if (s === 'id_desc' || s === 'newest') return { id: -1 };
        if (s === 'price_asc') return { price: 1, id: 1 };
        if (s === 'price_desc') return { price: -1, id: 1 };
        if (s === 'popular' || s === 'best_seller') return { is_best_seller: -1, id: 1 };
        return { id: 1 };
    },

    /**
     * Storefront list: filter category_id, search name, pagination, optional sort. Bỏ sản phẩm soft-delete.
     */
    async findCatalog(params) {
        const categoryId = params.categoryId;
        const qText = params.q != null ? String(params.q).trim() : '';
        const pageRaw = params.page;
        const sizeRaw = params.size;
        const sortSpec = this._catalogSort(params.sort);

        const filter = { $and: [notDeletedFilter()] };
        if (categoryId != null && categoryId !== '') {
            const parentIdNum = Number(categoryId);
            // If the given category is a parent, include products from its children.
            // This keeps storefront behavior consistent across pages that only pass `category=<id>`.
            const children = await Category.find({ parent_id: parentIdNum });
            const childIds = (children || []).map((c) => Number(c.id)).filter((n) => Number.isFinite(n));
            const ids = [parentIdNum, ...childIds];
            filter.$and.push({ category_id: { $in: ids } });
        }
        if (qText) {
            filter.$and.push({ name: { $regex: new RegExp(escapeRegex(qText), 'i') } });
        }

        const hasPage = pageRaw !== null && pageRaw !== undefined && pageRaw !== '';
        const hasSize = sizeRaw !== null && sizeRaw !== undefined && sizeRaw !== '';
        let queryBuilder = ProductModel.find(filter).sort(sortSpec);
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

    /** @param {number} [excludeProductId] — bỏ qua sản phẩm này (PUT đổi SKU) */
    async findOneBySku(sku, excludeProductId) {
        const normalized = normalizeSku(sku);
        if (!normalized) return null;
        const q = { sku: normalized };
        if (excludeProductId != null) q.id = { $ne: Number(excludeProductId) };
        const doc = await ProductModel.findOne(q).lean();
        return doc;
    },

    /**
     * Enrich product technical specs and persist in DB.
     * This keeps /products/:id/fetch-specs compatible with ProductDto contract.
     */
    async enrichSpecsById(id, options) {
        const publicOnly = options && options.publicOnly;
        const existing = await ProductModel.findOne({ id: Number(id) }).lean();
        if (!existing) return null;
        if (publicOnly && existing.isDeleted === true) return null;

        const enrichedData = enrichProductSpecs(existing);
        const doc = await ProductModel.findOneAndUpdate(
            { id: Number(id) },
            {
                $set: {
                    specifications: enrichedData.specifications,
                    storageOptions: enrichedData.storageOptions,
                    colors: enrichedData.colors
                }
            },
            { new: true }
        ).lean();

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

    async delete(id, deletedBy) {
        const doc = await ProductModel.findOneAndUpdate(
            { id: Number(id) },
            { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy || null } },
            { new: true }
        ).lean();
        return !!doc;
    }
};

module.exports = Product;
