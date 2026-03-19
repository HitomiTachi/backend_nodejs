var express = require('express');
var router = express.Router();
const slugify = require('slugify');
const Product = require('../schemas/products');

router.get('/', async function (req, res, next) {
    try {
        const nameQ = req.query.name || '';
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : Infinity;
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : 0;
        const page = req.query.page !== undefined ? parseInt(req.query.page) : null;
        const size = req.query.size !== undefined ? parseInt(req.query.size) : null;

        let data = await Product.find();
        let result = data.filter(e =>
            e.name.toLowerCase().includes(nameQ.toLowerCase()) &&
            e.price >= minPrice &&
            e.price <= maxPrice
        );

        const total = result.length;

        if (page !== null && size !== null) {
            const start = page * size;
            result = result.slice(start, start + size);
            return res.send({ data: result, total, page, size });
        }

        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.get('/featured', async function (req, res, next) {
    try {
        const data = await Product.find({ featured: 1 });
        res.send(data);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.get('/slug/:slug', async function (req, res, next) {
    try {
        const result = await Product.findOne({ slug: req.params.slug });
        if (result) {
            res.status(200).send(result);
        } else {
            res.status(404).send({ message: 'SLUG NOT FOUND' });
        }
    } catch (error) {
        res.status(404).send({ message: 'SLUG NOT FOUND' });
    }
});

router.get('/:id', async function (req, res, next) {
    try {
        const result = await Product.findById(req.params.id);
        if (result) {
            res.status(200).send(result);
        } else {
            res.status(404).send({ message: 'ID NOT FOUND' });
        }
    } catch (error) {
        res.status(404).send({ message: 'ID NOT FOUND' });
    }
});

router.post('/', async function (req, res, next) {
    try {
        const { name, price, description, category_id, image, sku, old_price, stock, tag, is_best_seller, featured, specifications } = req.body;
        const data = {
            name,
            slug: slugify(name, { replacement: '-', lower: true, locale: 'vi' }),
            price,
            category_id
        };
        if (description !== undefined) data.description = description;
        if (image !== undefined) data.image = image;
        if (sku !== undefined) data.sku = sku;
        if (old_price !== undefined) data.old_price = old_price;
        if (stock !== undefined) data.stock = stock;
        if (tag !== undefined) data.tag = tag;
        if (is_best_seller !== undefined) data.is_best_seller = is_best_seller;
        if (featured !== undefined) data.featured = featured;
        if (specifications !== undefined) {
            data.specifications = typeof specifications === 'object'
                ? JSON.stringify(specifications)
                : specifications;
        }

        const newObj = await Product.create(data);
        res.send(newObj);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.put('/:id', async function (req, res, next) {
    try {
        const data = { ...req.body };
        if (data.name) {
            data.slug = slugify(data.name, { replacement: '-', lower: true, locale: 'vi' });
        }
        if (data.specifications && typeof data.specifications === 'object') {
            data.specifications = JSON.stringify(data.specifications);
        }
        const result = await Product.update(req.params.id, data);
        if (!result) return res.status(404).send({ message: 'ID NOT FOUND' });
        res.status(200).send(result);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.delete('/:id', async function (req, res, next) {
    try {
        const deleted = await Product.delete(req.params.id);
        if (!deleted) return res.status(404).send({ message: 'ID NOT FOUND' });
        res.status(200).send({ message: 'deleted successfully' });
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;
