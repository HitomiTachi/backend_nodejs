var express = require('express');
var router = express.Router();
const slugify = require('slugify');
const Category = require('../schemas/categories');

router.get('/', async function (req, res, next) {
    try {
        const data = await Category.find();
        res.send(data);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.get('/slug/:slug', async function (req, res, next) {
    try {
        const result = await Category.findOne({ slug: req.params.slug });
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
        const result = await Category.findById(req.params.id);
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
        const { name, icon } = req.body;
        const data = {
            name,
            slug: slugify(name, { replacement: '-', lower: true, locale: 'vi' })
        };
        if (icon !== undefined) data.icon = icon;
        const newObj = await Category.create(data);
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
        const result = await Category.update(req.params.id, data);
        if (!result) return res.status(404).send({ message: 'ID NOT FOUND' });
        res.status(200).send(result);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.delete('/:id', async function (req, res, next) {
    try {
        const deleted = await Category.delete(req.params.id);
        if (!deleted) return res.status(404).send({ message: 'ID NOT FOUND' });
        res.status(200).send({ message: 'deleted successfully' });
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;
