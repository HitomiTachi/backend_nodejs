var express = require('express');
var router = express.Router();
const userController = require('../controllers/users');
const {
    RegisterValidator,
    handleResultValidator,
    ChangPasswordValidator,
    ChangePasswordSpecValidator,
    handleResultValidatorApi
} = require('../utils/validatorHandler');
const bcrypt = require('bcrypt');
const { checkLogin } = require('../utils/authHandler');
const { sendMail } = require('../utils/senMailHandler');
const { signAuthToken } = require('../utils/authToken');
const { toAuthUserDto, postLoginRedirectPath } = require('../utils/mappers/authDto');

const COOKIE_OPTS = {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
};

function setAuthCookie(res, token) {
    res.cookie('token_login_tungNT', token, COOKIE_OPTS);
}

router.post('/register', RegisterValidator, handleResultValidator, async function (req, res, next) {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const name = req.body.name;

        const existing = await userController.FindByEmail(email);
        if (existing) {
            return res.status(400).json({ message: 'Email da ton tai' });
        }

        const newUser = await userController.CreateAnUser(name, password, email);
        const token = signAuthToken(newUser);
        setAuthCookie(res, token);
        const userDto = toAuthUserDto(newUser);
        res.status(201).json({
            token: token,
            user: userDto,
            postLoginRedirect: postLoginRedirectPath(userDto)
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post('/login', async function (req, res, next) {
    try {
        const password = req.body.password;
        const email = req.body.email || req.body.username;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email va password khong duoc de trong' });
        }
        const user = await userController.FindByEmail(email);
        if (!user) {
            return res.status(403).json({ message: 'tai khoan khong ton tai' });
        }
        if (user.status === false) {
            return res.status(403).json({ message: 'tai khoan dang bi ban' });
        }
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(403).json({ message: 'thong tin dang nhap khong dung' });
        }
        await userController.UpdateUser(user.id, { loginCount: Number(user.loginCount || 0) + 1 });
        const latestUser = await userController.FindById(user.id);
        const token = signAuthToken(user);
        setAuthCookie(res, token);
        const userDto = toAuthUserDto(latestUser || user);
        res.json({
            token: token,
            user: userDto,
            postLoginRedirect: postLoginRedirectPath(userDto)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/me', checkLogin, function (req, res, next) {
    res.json(toAuthUserDto(req.user));
});

async function respondPasswordChanged(req, res) {
    const currentPassword = req.body.currentPassword ?? req.body.oldpassword;
    const newPassword = req.body.newPassword ?? req.body.newpassword;
    const userWithPass = await userController.FindByIdWithPassword(req.user.id);
    if (!bcrypt.compareSync(currentPassword, userWithPass.password_hash)) {
        return res.status(400).json({ message: 'Mat khau hien tai khong dung' });
    }
    await userController.UpdateUser(req.user.id, {
        password_hash: newPassword,
        password_changed_at: new Date()
    });
    const updated = await userController.FindById(req.user.id);
    const payload = { message: 'Doi mat khau thanh cong' };
    if (updated && updated.password_changed_at) {
        payload.passwordChangedAt = new Date(updated.password_changed_at).toISOString();
    }
    return res.json(payload);
}

/** TechHome spec §4.2: POST /auth/change-password — body camelCase */
router.post(
    '/change-password',
    checkLogin,
    ChangePasswordSpecValidator,
    handleResultValidatorApi,
    async function (req, res, next) {
        try {
            await respondPasswordChanged(req, res);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

/** Legacy path — body oldpassword / newpassword */
router.post('/changepassword', checkLogin, ChangPasswordValidator, handleResultValidatorApi, async function (req, res, next) {
    try {
        await respondPasswordChanged(req, res);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
    res.status(501).json({ message: 'Chuc nang nay hien chua duoc ho tro' });
});

module.exports = router;
