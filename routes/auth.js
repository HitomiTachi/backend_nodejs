var express = require('express');
var router = express.Router();
const userController = require('../controllers/users');
const {
    RegisterValidator,
    handleResultValidator,
    ChangePasswordSpecValidator,
    ResetPasswordNewValidator,
    handleResultValidatorApi
} = require('../utils/validatorHandler');
const { generateResetToken, hashResetToken } = require('../utils/passwordResetToken');
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
            return res.status(400).json({ message: 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.' });
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
            return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
        }
        const user = await userController.FindByEmail(email);
        if (!user) {
            return res.status(403).json({ message: 'Không tìm thấy tài khoản với email này.' });
        }
        if (user.status === false) {
            return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.' });
        }
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(403).json({ message: 'Mật khẩu không đúng. Vui lòng thử lại hoặc dùng “Quên mật khẩu”.' });
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
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;
    const userWithPass = await userController.FindByIdWithPassword(req.user.id);
    if (!bcrypt.compareSync(currentPassword, userWithPass.password_hash)) {
        return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
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

router.post('/logout', checkLogin, function (req, res, next) {
    res.cookie('token_login_tungNT', null, {
        maxAge: 0,
        httpOnly: true,
        secure: false
    });
    res.send('logout');
});

function passwordResetTtlMs() {
    const n = parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES, 10);
    const minutes = Number.isFinite(n) && n > 0 ? n : 60;
    return minutes * 60 * 1000;
}

function frontendResetPasswordUrl(plainToken) {
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const path = `/reset-password/${encodeURIComponent(plainToken)}`;
    if (process.env.FRONTEND_USE_HASH_ROUTER === '0' || process.env.FRONTEND_USE_HASH_ROUTER === 'false') {
        return `${base}${path}`;
    }
    return `${base}/#${path}`;
}

router.post('/forgotpassword', async function (req, res, next) {
    try {
        const { email } = req.body;
        const user = email ? await userController.FindByEmail(email) : null;
        if (user) {
            const { plain, hash } = generateResetToken();
            const expires = new Date(Date.now() + passwordResetTtlMs());
            await userController.UpdateUser(user.id, {
                password_reset_token_hash: hash,
                password_reset_expires: expires
            });
            await sendMail(user.email, frontendResetPasswordUrl(plain));
        }
        res.send('check mail de biet');
    } catch (err) {
        res.send('check mail de biet');
    }
});

router.post(
    '/resetpassword/:token',
    ResetPasswordNewValidator,
    handleResultValidatorApi,
    async function (req, res, next) {
        try {
            const rawToken = req.params.token;
            if (!rawToken || String(rawToken).trim().length < 16) {
                return res.status(400).json({ message: 'Token khong hop le' });
            }
            const tokenHash = hashResetToken(decodeURIComponent(rawToken));
            const user = await userController.FindByPasswordResetHash(tokenHash);
            if (!user) {
                return res.status(400).json({ message: 'Lien ket khong hop le hoac da het han' });
            }
            const newPassword = req.body.newPassword;
            await userController.UpdateUser(user.id, {
                password_hash: newPassword,
                password_changed_at: new Date(),
                password_reset_token_hash: null,
                password_reset_expires: null
            });
            res.json({ message: 'Dat lai mat khau thanh cong' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = router;
