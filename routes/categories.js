var express = require('express');
var router = express.Router();
const slugify = require('slugify');
const Category = require('../schemas/categories');
const { toCategoryDto } = require('../utils/mappers/catalogDto');

function buildCategorySlug(name) {
    return slugify(String(name).trim(), { replacement: '-', lower: true, locale: 'vi' });
}

function isDuplicateKeyError(err) {
    return err && (err.code === 11000 || err.code === 11001);
}

router.get('/', async function (req, res, next) {
    try {
        const data = await Category.find();
        res.json(data.map(toCategoryDto));
    } catch (error) {
        res.status(500).json({ message: error.message });
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

router.get('/:id', async function (req, res, next) {
    try {
        const result = await Category.findById(req.params.id);
        if (result) {
            res.status(200).json(toCategoryDto(result));
        } else {
            res.status(404).json({ message: 'ID NOT FOUND' });
        }
    } catch (error) {
        res.status(404).json({ message: 'ID NOT FOUND' });
    }
});

router.post('/', async function (req, res, next) {
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
        const newObj = await Category.create(data);
        res.json(toCategoryDto(newObj));
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return res.status(409).json({ message: 'DUPLICATE_SLUG' });
        }
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async function (req, res, next) {
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

router.delete('/:id', async function (req, res, next) {
    try {
        const deleted = await Category.delete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'ID NOT FOUND' });
        res.status(200).json({ message: 'deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
