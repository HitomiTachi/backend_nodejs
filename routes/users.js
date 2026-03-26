var express = require('express');
var router = express.Router();
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const { userCreateValidator, userUpdateValidator, handleResultValidator } = require('../utils/validatorHandler');
const userController = require('../controllers/users');

function toAssignmentUserDto(user) {
    if (!user) return null;
    return {
        ...user,
        username: user.email || '',
        fullName: user.name || '',
        avatarUrl: user.avatar_url || null,
        status: user.status !== false,
        loginCount: Number(user.loginCount || 0)
    };
}

router.get('/', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
        const users = await userController.GetAllUser({ includeDeleted });
        res.send(users.map(toAssignmentUserDto));
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

router.get('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const result = await userController.FindById(req.params.id);
        if (result) {
            res.send(toAssignmentUserDto(result));
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
        const { name, email, status, loginCount, avatar_url, role } = req.body;
        const data = {};
        if (name) data.name = name;
        if (email) data.email = email;
        if (status !== undefined) data.status = !!status;
        if (loginCount !== undefined) data.loginCount = Number(loginCount) || 0;
        if (avatar_url !== undefined) data.avatar_url = avatar_url;
        if (role !== undefined) data.role = role;
        const updated = await userController.UpdateUser(id, data);
        if (!updated) return res.status(404).send({ message: 'id not found' });
        res.send(toAssignmentUserDto(updated));
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.post('/enable', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const email = req.body.email || req.body.username;
        if (!email) return res.status(400).json({ message: 'email hoac username la bat buoc' });
        const found = await userController.FindByEmail(email);
        if (!found) return res.status(404).json({ message: 'id not found' });
        const updated = await userController.UpdateUser(found.id, { status: true });
        res.json(toAssignmentUserDto(updated));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/disable', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const email = req.body.email || req.body.username;
        if (!email) return res.status(400).json({ message: 'email hoac username la bat buoc' });
        const found = await userController.FindByEmail(email);
        if (!found) return res.status(404).json({ message: 'id not found' });
        const updated = await userController.UpdateUser(found.id, { status: false });
        res.json(toAssignmentUserDto(updated));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res, next) {
    try {
        const deleted = await userController.DeleteUser(req.params.id, req.user && req.user.id);
        if (!deleted) return res.status(404).send({ message: 'id not found' });
        res.send({ message: 'deleted successfully' });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
