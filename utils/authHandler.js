const jwt = require('jsonwebtoken');
const userController = require('../controllers/users');

module.exports = {
    checkLogin: async function (req, res, next) {
        let token;
        if (req.cookies.token_login_tungNT) {
            token = req.cookies.token_login_tungNT;
        } else {
            token = req.headers.authorization;
            if (!token || !token.startsWith('Bearer')) {
                return res.status(403).send('ban chua dang nhap');
            }
            token = token.split(' ')[1];
        }
        try {
            const result = jwt.verify(token, 'secret');
            if (result.exp * 1000 > Date.now()) {
                const user = await userController.FindById(result.id);
                if (!user) {
                    return res.status(403).send('ban chua dang nhap');
                }
                req.user = user;
                next();
            } else {
                res.status(403).send('ban chua dang nhap');
            }
        } catch (error) {
            res.status(403).send('ban chua dang nhap');
        }
    },

    CheckPermission: function (...requiredPermissions) {
        return function (req, res, next) {
            next();
        };
    }
};
