var express = require('express');
var router = express.Router();
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const { userCreateValidator, userUpdateValidator, handleResultValidator } = require('../utils/validatorHandler');
const userController = require('../controllers/users');

router.get('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const users = await userController.GetAllUser();
        res.send(users);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

router.get('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const result = await userController.FindById(req.params.id);
        if (result) {
            res.send(result);
        } else {
            res.status(404).send({ message: 'id not found' });
        }
    } catch (error) {
        res.status(404).send({ message: 'id not found' });
    }
});

router.post('/', checkLogin, CheckPermission('ADMIN'), userCreateValidator, handleResultValidator, async function (req, res, next) {
    try {
        const { name, email, password } = req.body;
        const newItem = await userController.CreateAnUser(name, password, email);
        res.send(newItem);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.put('/:id', checkLogin, CheckPermission('ADMIN'), userUpdateValidator, handleResultValidator, async function (req, res, next) {
    try {
        const id = req.params.id;
        const { name, email } = req.body;
        const data = {};
        if (name) data.name = name;
        if (email) data.email = email;
        const updated = await userController.UpdateUser(id, data);
        if (!updated) return res.status(404).send({ message: 'id not found' });
        res.send(updated);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.delete('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const deleted = await userController.DeleteUser(req.params.id);
        if (!deleted) return res.status(404).send({ message: 'id not found' });
        res.send({ message: 'deleted successfully' });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
