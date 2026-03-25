const userController = require('../controllers/users');
const { verifyAuthToken } = require('./authToken');

function extractBearerToken(req) {
    const h = req.headers.authorization;
    if (!h || typeof h !== 'string') return null;
    const parts = h.trim().split(/\s+/);
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        return parts[1];
    }
    return null;
}

function sendNotLoggedIn(res) {
    return res.status(403).json({ message: 'ban chua dang nhap' });
}

function normalizeRole(value) {
    if (value == null) return '';
    return String(value).trim().toUpperCase();
}

module.exports = {
    checkLogin: async function (req, res, next) {
        let token = extractBearerToken(req);
        if (!token && req.cookies && req.cookies.token_login_tungNT) {
            token = req.cookies.token_login_tungNT;
        }
        if (!token) {
            return sendNotLoggedIn(res);
        }
        try {
            const result = verifyAuthToken(token);
            if (result.exp * 1000 <= Date.now()) {
                return sendNotLoggedIn(res);
            }
            const user = await userController.FindById(result.id);
            if (!user) {
                return sendNotLoggedIn(res);
            }
            req.user = user;
            req.authPayload = result;
            next();
        } catch (error) {
            return sendNotLoggedIn(res);
        }
    },

    CheckPermission: function (...requiredPermissions) {
        return function (req, res, next) {
            const requiredRoles = requiredPermissions.map(normalizeRole).filter(Boolean);
            if (requiredRoles.length === 0) {
                return next();
            }
            const currentRole = normalizeRole(req.user && req.user.role);
            if (requiredRoles.includes(currentRole)) {
                return next();
            }
            return res.status(403).json({ message: 'ban khong co quyen' });
        };
    }
};
