const jwt = require('jsonwebtoken');
const fs = require('fs');

function normalizePem(value) {
    if (!value || typeof value !== 'string') return null;
    return value.replace(/\\n/g, '\n');
}

const JWT_ALGORITHM = 'RS256';

function readPemFromPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        throw new Error(`Khong doc duoc key file: ${filePath}`);
    }
}

function resolveJwtKeys() {
    const privateFromPath = readPemFromPath(process.env.JWT_PRIVATE_KEY_PATH);
    const publicFromPath = readPemFromPath(process.env.JWT_PUBLIC_KEY_PATH);
    const privateFromEnv = normalizePem(process.env.JWT_PRIVATE_KEY);
    const publicFromEnv = normalizePem(process.env.JWT_PUBLIC_KEY);

    const privateKey = privateFromPath || privateFromEnv;
    const publicKey = publicFromPath || publicFromEnv;

    if (!privateKey || !publicKey) {
        throw new Error(
            'Can cau hinh JWT_PRIVATE_KEY_PATH/JWT_PUBLIC_KEY_PATH hoac JWT_PRIVATE_KEY/JWT_PUBLIC_KEY de su dung RS256'
        );
    }
    return { privateKey, publicKey };
}

function signAuthToken(user) {
    const { privateKey } = resolveJwtKeys();
    const payload = {
        id: user.id,
        role: user.role != null ? user.role : 'USER'
    };
    return jwt.sign(payload, privateKey, {
        expiresIn: '30d',
        algorithm: JWT_ALGORITHM
    });
}

function verifyAuthToken(token) {
    const { publicKey } = resolveJwtKeys();
    return jwt.verify(token, publicKey, {
        algorithms: [JWT_ALGORITHM]
    });
}

module.exports = {
    JWT_ALGORITHM,
    signAuthToken,
    verifyAuthToken
};
