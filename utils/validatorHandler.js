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

const passwordMsg = `password dai it nhat ${options.password.minLength} ki tu, trong do co it nhat ${options.password.minNumbers} so, ${options.password.minUppercase} chu hoa, ${options.password.minLowercase} chu thuong, ${options.password.minSymbols} ki tu dac biet`;

module.exports = {
    userCreateValidator: [
        body('email').notEmpty().withMessage('Email khong duoc rong').isEmail().withMessage('email sai dinh dang'),
        body('name').notEmpty().withMessage('Ten khong duoc de trong'),
        body('password').isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    userUpdateValidator: [
        body('email').optional({ checkFalsy: true }).isEmail().withMessage('email sai dinh dang').normalizeEmail(),
        body('name').optional().notEmpty().withMessage('Ten khong duoc de trong')
    ],

    RegisterValidator: [
        body('email').notEmpty().withMessage('email khong duoc rong').bail().isEmail().withMessage('email sai dinh dang').normalizeEmail(),
        body('name').notEmpty().withMessage('ten khong duoc de trong'),
        body('password').notEmpty().withMessage('password khong duoc de trong').bail().isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    ChangPasswordValidator: [
        body('oldpassword').notEmpty().withMessage('old password khong duoc de trong'),
        body('newpassword').notEmpty().withMessage('new password khong duoc de trong').bail().isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    /** TechHome spec: POST /auth/change-password — body currentPassword, newPassword (camelCase) */
    ChangePasswordSpecValidator: [
        body('currentPassword').notEmpty().withMessage('currentPassword khong duoc de trong'),
        body('newPassword').notEmpty().withMessage('newPassword khong duoc de trong').bail().isStrongPassword(options.password).withMessage(passwordMsg)
    ],

    handleResultValidator: function (req, res, next) {
        const result = validationResult(req);
        if (result.errors.length > 0) {
            return res.status(400).send(result.errors.map(e => e.msg));
        }
        next();
    },

    /** Trả `{ message: string }` cho API JSON (lỗi đầu tiên) — dùng cho change-password, v.v. */
    handleResultValidatorApi: function (req, res, next) {
        const result = validationResult(req);
        if (result.errors.length > 0) {
            return res.status(400).json({ message: result.errors[0].msg });
        }
        next();
    }
};
