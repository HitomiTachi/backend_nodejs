var express = require('express');
var router = express.Router();
const userController = require('../controllers/users');
const { RegisterValidator, handleResultValidator, ChangPasswordValidator } = require('../utils/validatorHandler');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { checkLogin } = require('../utils/authHandler');
const { sendMail } = require('../utils/senMailHandler');

router.post('/register', async function (req, res, next) {
    try {
        console.log('[REGISTER] body received:', req.body);
        const { email, password } = req.body;
        const name = req.body.name
            || req.body.username
            || req.body.fullName
            || req.body.full_name
            || `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim()
            || 'User';

        if (!email || !password) {
            return res.status(400).send({ message: 'Email va password khong duoc de trong' });
        }
        const existing = await userController.FindByEmail(email);
        if (existing) {
            return res.status(400).send({ message: 'Email da ton tai' });
        }
        const newUser = await userController.CreateAnUser(name, password, email);
        res.send({ message: 'dang ki thanh cong', user: newUser });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.post('/login', async function (req, res, next) {
    try {
        const { password } = req.body;
        // nhận cả email lẫn username từ frontend
        const email = req.body.email || req.body.username;

        console.log('[LOGIN] body received:', req.body);
        console.log('[LOGIN] email:', email);

        if (!email || !password) {
            return res.status(400).send({ message: 'Email va password khong duoc de trong' });
        }
        const user = await userController.FindByEmail(email);
        console.log('[LOGIN] user found:', user ? `id=${user.id}` : 'NOT FOUND');
        if (!user) {
            return res.status(403).send({ message: 'Tai khoan khong ton tai' });
        }
        if (bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id }, 'secret', { expiresIn: '30d' });
            res.cookie('token_login_tungNT', token, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: false
            });
            res.send({ token, user: { id: user.id, name: user.name, email: user.email } });
        } else {
            res.status(403).send({ message: 'Mat khau khong dung' });
        }
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

router.get('/me', checkLogin, function (req, res, next) {
    res.send(req.user);
});

router.post('/changepassword', checkLogin, ChangPasswordValidator, handleResultValidator, async function (req, res, next) {
    try {
        const { oldpassword, newpassword } = req.body;
        const userWithPass = await userController.FindByIdWithPassword(req.user.id);
        if (!bcrypt.compareSync(oldpassword, userWithPass.password_hash)) {
            return res.status(400).send('Mat khau cu khong dung');
        }
        await userController.UpdateUser(req.user.id, {
            password_hash: newpassword,
            password_changed_at: new Date()
        });
        res.send('da doi pass');
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

router.post('/logout', checkLogin, function (req, res, next) {
    res.cookie('token_login_tungNT', null, {
        maxAge: 0,
        httpOnly: true,
        secure: false
    });
    res.send('logout');
});

router.post('/forgotpassword', async function (req, res, next) {
    try {
        const { email } = req.body;
        const user = await userController.FindByEmail(email);
        if (user) {
            await sendMail(user.email, 'http://localhost:3000/api/v1/auth/resetpassword');
        }
        res.send('check mail de biet');
    } catch (err) {
        res.send('check mail de biet');
    }
});

router.post('/resetpassword/:token', async function (req, res, next) {
    res.status(501).send({ message: 'Chuc nang nay hien chua duoc ho tro' });
});

module.exports = router;
