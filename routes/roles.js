var express = require('express');
var router = express.Router();
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const Role = require('../schemas/roles');

router.get('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
        const items = await Role.find({}, { includeDeleted });
        res.send(items);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

router.get('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
        const item = await Role.findById(req.params.id, { includeDeleted });
        if (!item) return res.status(404).send({ message: 'id not found' });
        res.send(item);
    } catch (error) {
        res.status(404).send({ message: 'id not found' });
    }
});

router.post('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        if (!req.body || !req.body.name) {
            return res.status(400).send({ message: 'name la bat buoc' });
        }
        const created = await Role.create({
            name: req.body.name,
            description: req.body.description
        });
        res.send(created);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.put('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const data = {};
        if (req.body.name !== undefined) data.name = req.body.name;
        if (req.body.description !== undefined) data.description = req.body.description;
        const updated = await Role.update(req.params.id, data);
        if (!updated) return res.status(404).send({ message: 'id not found' });
        res.send(updated);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.delete('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const deleted = await Role.delete(req.params.id);
        if (!deleted) return res.status(404).send({ message: 'id not found' });
        res.send({ message: 'deleted successfully' });
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;
