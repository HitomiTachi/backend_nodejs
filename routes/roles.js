var express = require('express');
var router = express.Router();

router.get('/', async function (req, res, next) {
    res.send([]);
});

router.get('/:id', async function (req, res, next) {
    res.status(404).send({ message: 'id not found' });
});

router.post('/', async function (req, res, next) {
    res.status(501).send({ message: 'Roles are not supported in the current database schema' });
});

router.put('/:id', async function (req, res, next) {
    res.status(501).send({ message: 'Roles are not supported in the current database schema' });
});

router.delete('/:id', async function (req, res, next) {
    res.status(501).send({ message: 'Roles are not supported in the current database schema' });
});

module.exports = router;
