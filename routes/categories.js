var express = require('express');
var router = express.Router();
const slugify = require('slugify');
const Category = require('../schemas/categories');
const Product = require('../schemas/products');
const { toCategoryDto, toProductDto } = require('../utils/mappers/catalogDto');
const { checkLogin, CheckPermission } = require('../utils/authHandler');

function buildCategorySlug(name) {
    return slugify(String(name).trim(), { replacement: '-', lower: true, locale: 'vi' });
}

function isDuplicateKeyError(err) {
    return err && (err.code === 11000 || err.code === 11001);
}

router.get('/', async function (req, res, next) {
    try {
        const nameQ = req.query.name != null ? String(req.query.name).trim().toLowerCase() : '';
        const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
        const parentIdRaw = req.query.parentId;
        if (parentIdRaw !== undefined && parentIdRaw !== null && String(parentIdRaw).trim() !== '') {
            const s = String(parentIdRaw).trim().toLowerCase();
            const asNull = s === 'null' || s === 'undefined' || s === 'none';
            const parentId = asNull ? null : Number(parentIdRaw);
            const data = await Category.find({ parent_id: parentId, includeDeleted });
            const filtered = nameQ ? data.filter((e) => String(e.name || '').toLowerCase().includes(nameQ)) : data;
            return res.json(filtered.map(toCategoryDto));
        }
        const data = await Category.find({ includeDeleted });
        const filtered = nameQ ? data.filter((e) => String(e.name || '').toLowerCase().includes(nameQ)) : data;
        res.json(filtered.map(toCategoryDto));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id/products', async function (req, res, next) {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: 'ID NOT FOUND' });
        const products = await Product.findCatalog({
            categoryId: req.params.id,
            sort: req.query.sort
        });
        return res.json(products.map(toProductDto));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/slug/:slug', async function (req, res, next) {
    try {
        const result = await Category.findOne({ slug: req.params.slug });
        if (result) {
            res.status(200).json(toCategoryDto(result));
        } else {
            res.status(404).json({ message: 'SLUG NOT FOUND' });
        }
    } catch (error) {
        res.status(404).json({ message: 'SLUG NOT FOUND' });
    }
});

// Convenient endpoint: get children categories by parent slug.
router.get('/children/slug/:slug', async function (req, res, next) {
    try {
        const parent = await Category.findOne({ slug: req.params.slug });
        if (!parent) return res.status(404).json({ message: 'PARENT_SLUG_NOT_FOUND' });
        const children = await Category.find({ parent_id: Number(parent.id) });
        return res.json(children.map(toCategoryDto));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async function (req, res, next) {
    try {
        const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
        const result = await Category.findById(req.params.id, { includeDeleted });
        if (result) {
            res.status(200).json(toCategoryDto(result));
        } else {
            res.status(404).json({ message: 'ID NOT FOUND' });
        }
    } catch (error) {
        res.status(404).json({ message: 'ID NOT FOUND' });
    }
});

router.post('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const rawName = req.body && req.body.name;
        const name = typeof rawName === 'string' ? rawName.trim() : '';
        if (!name) return res.status(400).json({ message: 'NAME_REQUIRED' });
        const slug = buildCategorySlug(name);
        if (!slug) return res.status(400).json({ message: 'INVALID_SLUG' });
        const clash = await Category.findOne({ slug });
        if (clash) return res.status(409).json({ message: 'DUPLICATE_SLUG' });
        const data = { name, slug };
        if (req.body.icon !== undefined) data.icon = req.body.icon;
        if (req.body.imageUrl !== undefined) {
            const v = req.body.imageUrl;
            data.imageUrl = typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
        }
        // Optional hierarchy
        if (req.body.parentId !== undefined) {
            const p = req.body.parentId;
            data.parent_id = p === null || p === 'null' || p === 'undefined' ? null : Number(p);
        } else if (req.body.parent_id !== undefined) {
            const p = req.body.parent_id;
            data.parent_id = p === null || p === 'null' || p === 'undefined' ? null : Number(p);
        }
        const newObj = await Category.create(data);
        res.json(toCategoryDto(newObj));
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return res.status(409).json({ message: 'DUPLICATE_SLUG' });
        }
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const data = { ...req.body };
        if (data.imageUrl !== undefined) {
            const v = data.imageUrl;
            data.imageUrl = typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
        }
        if (data.name !== undefined) {
            const name = typeof data.name === 'string' ? data.name.trim() : '';
            if (!name) return res.status(400).json({ message: 'NAME_REQUIRED' });
            const slug = buildCategorySlug(name);
            if (!slug) return res.status(400).json({ message: 'INVALID_SLUG' });
            const clash = await Category.findOneBySlugExcludingId(slug, req.params.id);
            if (clash) return res.status(409).json({ message: 'DUPLICATE_SLUG' });
            data.name = name;
            data.slug = slug;
        }
        // Optional hierarchy
        if (data.parentId !== undefined) {
            const p = data.parentId;
            data.parent_id = p === null || p === 'null' || p === 'undefined' ? null : Number(p);
            delete data.parentId;
        } else if (data.parent_id !== undefined) {
            const p = data.parent_id;
            data.parent_id = p === null || p === 'null' || p === 'undefined' ? null : Number(p);
        }
        const result = await Category.update(req.params.id, data);
        if (!result) return res.status(404).json({ message: 'ID NOT FOUND' });
        res.status(200).json(toCategoryDto(result));
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return res.status(409).json({ message: 'DUPLICATE_SLUG' });
        }
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const deleted = await Category.delete(req.params.id, req.user && req.user.id);
        if (!deleted) return res.status(404).json({ message: 'ID NOT FOUND' });
        res.status(200).json({ message: 'deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
