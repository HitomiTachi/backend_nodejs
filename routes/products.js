var express = require('express');
var router = express.Router();
const slugify = require('slugify');
const Product = require('../schemas/products');
const { toProductDto } = require('../utils/mappers/catalogDto');

function buildCreateUpdatePayload(body) {
    const name = body.name;
    const data = {};
    if (name !== undefined) {
        data.name = name;
        data.slug = slugify(name, { replacement: '-', lower: true, locale: 'vi' });
    }
    if (body.slug !== undefined && name === undefined) data.slug = body.slug;

    const categoryId = body.categoryId != null ? body.categoryId : body.category_id;
    if (categoryId !== undefined) data.category_id = categoryId;

    if (body.price !== undefined) data.price = body.price;
    if (body.description !== undefined) data.description = body.description;
    if (body.image !== undefined) data.image = body.image;
    if (body.images !== undefined) data.images = body.images;
    if (body.sku !== undefined) data.sku = body.sku;
    if (body.old_price !== undefined) data.old_price = body.old_price;
    if (body.salePrice !== undefined) data.salePrice = body.salePrice;
    if (body.stock !== undefined) data.stock = body.stock;
    if (body.tag !== undefined) data.tag = body.tag;
    if (body.is_best_seller !== undefined) data.is_best_seller = body.is_best_seller;
    if (body.featured !== undefined) data.featured = body.featured;
    if (body.colors !== undefined) data.colors = body.colors;
    if (body.storageOptions !== undefined) data.storageOptions = body.storageOptions;
    if (body.specifications !== undefined) {
        data.specifications =
            typeof body.specifications === 'object' ? JSON.stringify(body.specifications) : body.specifications;
    }
    if (body.isDeleted !== undefined) data.isDeleted = body.isDeleted;

    return data;
}

router.get('/', async function (req, res, next) {
    try {
        const data = await Product.findCatalog({
            categoryId: req.query.category,
            q: req.query.q,
            page: req.query.page,
            size: req.query.size
        });
        res.json(data.map(toProductDto));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/featured', async function (req, res, next) {
    try {
        const data = await Product.findFeatured();
        res.json(data.map(toProductDto));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/slug/:slug', async function (req, res, next) {
    try {
        const result = await Product.findOne({ slug: req.params.slug });
        if (result && result.isDeleted === true) {
            return res.status(404).json({ message: 'SLUG NOT FOUND' });
        }
        if (result) {
            res.status(200).json(toProductDto(result));
        } else {
            res.status(404).json({ message: 'SLUG NOT FOUND' });
        }
    } catch (error) {
        res.status(404).json({ message: 'SLUG NOT FOUND' });
    }
});

router.post('/:id/fetch-specs', async function (req, res, next) {
    try {
        const result = await Product.enrichSpecsById(req.params.id, { publicOnly: true });
        if (!result) {
            return res.status(404).json({ message: 'ID NOT FOUND' });
        }
        res.json(toProductDto(result));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async function (req, res, next) {
    try {
        const result = await Product.findById(req.params.id, { publicOnly: true });
        if (result) {
            res.status(200).json(toProductDto(result));
        } else {
            res.status(404).json({ message: 'ID NOT FOUND' });
        }
    } catch (error) {
        res.status(404).json({ message: 'ID NOT FOUND' });
    }
});

router.post('/', async function (req, res, next) {
    try {
        const body = req.body;
        const data = buildCreateUpdatePayload(body);
        if (!data.name || data.category_id === undefined || data.price === undefined) {
            return res.status(400).json({ message: 'name, categoryId (or category_id), and price are required' });
        }
        if (!data.slug) {
            data.slug = slugify(data.name, { replacement: '-', lower: true, locale: 'vi' });
        }
        const newObj = await Product.create(data);
        res.json(toProductDto(newObj));
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async function (req, res, next) {
    try {
        const data = buildCreateUpdatePayload(req.body);
        if (data.name) {
            data.slug = slugify(data.name, { replacement: '-', lower: true, locale: 'vi' });
        }
        if (req.body.specifications && typeof req.body.specifications === 'object') {
            data.specifications = JSON.stringify(req.body.specifications);
        }
        const result = await Product.update(req.params.id, data);
        if (!result) return res.status(404).json({ message: 'ID NOT FOUND' });
        res.status(200).json(toProductDto(result));
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', async function (req, res, next) {
    try {
        const deleted = await Product.delete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'ID NOT FOUND' });
        res.status(200).json({ message: 'deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
