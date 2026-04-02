const crypto = require('crypto');

function parseEnvRequired(name) {
    const value = process.env[name];
    if (value == null || String(value).trim() === '') {
        const err = new Error(`Missing env ${name}`);
        err.status = 503;
        throw err;
    }
    return String(value).trim();
}

function parseEnvOptional(name, fallback) {
    const value = process.env[name];
    if (value == null || String(value).trim() === '') return fallback;
    return String(value).trim();
}

function parseIntSafe(value, fallback) {
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) ? n : fallback;
}

function momoConfigFromEnv() {
    return {
        endpoint: parseEnvOptional('MOMO_ENDPOINT', 'https://test-payment.momo.vn'),
        createPath: parseEnvOptional('MOMO_CREATE_PATH', '/v2/gateway/api/create'),
        partnerCode: parseEnvRequired('MOMO_PARTNER_CODE'),
        accessKey: parseEnvRequired('MOMO_ACCESS_KEY'),
        secretKey: parseEnvRequired('MOMO_SECRET_KEY'),
        redirectUrl: parseEnvRequired('MOMO_REDIRECT_URL'),
        ipnUrl: parseEnvRequired('MOMO_IPN_URL'),
        requestType: parseEnvOptional('MOMO_REQUEST_TYPE', 'captureWallet'),
        lang: parseEnvOptional('MOMO_LANG', 'vi'),
        partnerName: parseEnvOptional('MOMO_PARTNER_NAME', 'TechHome'),
        storeId: parseEnvOptional('MOMO_STORE_ID', 'TechHomeStore'),
        autoCapture: parseEnvOptional('MOMO_AUTO_CAPTURE', 'true').toLowerCase() !== 'false',
        expireMinutes: parseIntSafe(parseEnvOptional('MOMO_EXPIRE_MINUTES', '15'), 15)
    };
}

function signHmacSha256(raw, secretKey) {
    return crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
}

function buildCreateRawSignature(payload) {
    return (
        `accessKey=${payload.accessKey}` +
        `&amount=${payload.amount}` +
        `&extraData=${payload.extraData}` +
        `&ipnUrl=${payload.ipnUrl}` +
        `&orderId=${payload.orderId}` +
        `&orderInfo=${payload.orderInfo}` +
        `&partnerCode=${payload.partnerCode}` +
        `&redirectUrl=${payload.redirectUrl}` +
        `&requestId=${payload.requestId}` +
        `&requestType=${payload.requestType}`
    );
}

function buildIpnRawSignature(payload) {
    const fields = [
        'accessKey',
        'amount',
        'extraData',
        'message',
        'orderId',
        'orderInfo',
        'orderType',
        'partnerCode',
        'payType',
        'requestId',
        'responseTime',
        'resultCode',
        'transId'
    ];
    return fields
        .filter((k) => payload[k] !== undefined && payload[k] !== null)
        .map((k) => `${k}=${payload[k]}`)
        .join('&');
}

async function createMomoPayment(payload) {
    const cfg = momoConfigFromEnv();
    const rawSignature = buildCreateRawSignature({
        accessKey: cfg.accessKey,
        amount: payload.amount,
        extraData: payload.extraData,
        ipnUrl: cfg.ipnUrl,
        orderId: payload.gatewayOrderId,
        orderInfo: payload.orderInfo,
        partnerCode: cfg.partnerCode,
        redirectUrl: cfg.redirectUrl,
        requestId: payload.requestId,
        requestType: cfg.requestType
    });

    const signature = signHmacSha256(rawSignature, cfg.secretKey);
    const reqBody = {
        partnerCode: cfg.partnerCode,
        partnerName: cfg.partnerName,
        storeId: cfg.storeId,
        requestId: payload.requestId,
        amount: payload.amount,
        orderId: payload.gatewayOrderId,
        orderInfo: payload.orderInfo,
        redirectUrl: cfg.redirectUrl,
        ipnUrl: cfg.ipnUrl,
        lang: cfg.lang,
        autoCapture: cfg.autoCapture,
        requestType: cfg.requestType,
        extraData: payload.extraData,
        signature
    };

    const url = `${cfg.endpoint}${cfg.createPath}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || `MoMo create failed (${res.status})`);
        err.status = 502;
        throw err;
    }

    return { data, cfg };
}

function verifyMomoIpnSignature(payload) {
    const cfg = momoConfigFromEnv();
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.signature) return false;
    const raw = buildIpnRawSignature(payload);
    const expected = signHmacSha256(raw, cfg.secretKey);
    return String(expected) === String(payload.signature);
}

module.exports = {
    momoConfigFromEnv,
    createMomoPayment,
    verifyMomoIpnSignature
};
