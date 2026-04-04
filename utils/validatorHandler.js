const { body, validationResult } = require('express-validator');

const options = {
    password: {
        minLength: 8,
        minLowercase: 1,
        minNumbers: 1,
        minUppercase: 1,
        minSymbols: 1
    }
};

const passwordMsg = `Mật khẩu ít nhất ${options.password.minLength} ký tự, gồm ít nhất ${options.password.minNumbers} chữ số, ${options.password.minUppercase} chữ hoa, ${options.password.minLowercase} chữ thường và ${options.password.minSymbols} ký tự đặc biệt.`;

module.exports = {
    userCreateValidator: [
        body('email').notEmpty().withMessage('Email không được để trống.').isEmail().withMessage('Email không đúng định dạng.'),
        body('name').notEmpty().withMessage('Tên không được để trống.'),
        body('password').isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    userUpdateValidator: [
        body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email không đúng định dạng.').normalizeEmail(),
        body('name').optional().notEmpty().withMessage('Tên không được để trống.')
    ],

    RegisterValidator: [
        body('email').notEmpty().withMessage('Email không được để trống.').bail().isEmail().withMessage('Email không đúng định dạng.').normalizeEmail(),
        body('name').notEmpty().withMessage('Họ tên không được để trống.'),
        body('password').notEmpty().withMessage('Mật khẩu không được để trống.').bail().isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    /** TechHome spec: POST /auth/change-password — body currentPassword, newPassword (camelCase) */
    ChangePasswordSpecValidator: [
        body('currentPassword').notEmpty().withMessage('Mật khẩu hiện tại không được để trống.'),
        body('newPassword').notEmpty().withMessage('Mật khẩu mới không được để trống.').bail().isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    /** POST /auth/resetpassword/:token — body newPassword */
    ResetPasswordNewValidator: [
        body('newPassword').notEmpty().withMessage('Mật khẩu mới không được để trống.').bail().isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    /** Trả JSON thống nhất `{ message, errors }` để frontend hiển thị rõ (không còn mảng JSON thuần). */
    handleResultValidator: function (req, res, next) {
        const result = validationResult(req);
        if (result.errors.length > 0) {
            const msgs = result.errors.map((e) => e.msg);
            return res.status(400).json({
                message: msgs.length === 1 ? msgs[0] : msgs.join(' '),
                errors: msgs
            });
        }
        next();
    },

    /** Trả `{ message: string }` cho API JSON (lỗi đầu tiên) — dùng cho change-password, v.v. */
    handleResultValidatorApi: function (req, res, next) {
        const result = validationResult(req);
        if (result.errors.length > 0) {
            const msgs = result.errors.map((e) => e.msg);
            return res.status(400).json({
                message: msgs.length === 1 ? msgs[0] : msgs.join(' '),
                errors: msgs
            });
        }
        next();
    }
};
