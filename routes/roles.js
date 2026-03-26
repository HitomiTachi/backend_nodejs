var express = require('express');
var router = express.Router();
const { checkLogin, CheckPermission } = require('../utils/authHandler');

router.get('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    res.send([]);
});

router.get('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    res.status(404).send({ message: 'id not found' });
});

router.post('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    res.status(501).send({ message: 'Roles are not supported in the current database schema' });
});

router.put('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    res.status(501).send({ message: 'Roles are not supported in the current database schema' });
});

router.delete('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    res.status(501).send({ message: 'Roles are not supported in the current database schema' });
});

module.exports = router;
