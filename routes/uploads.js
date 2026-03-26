/**
 * Presigned upload cho asset admin (ảnh sản phẩm / danh mục) — cùng bucket R2 với avatar.
 */

var express = require('express');
var router = express.Router();
const crypto = require('crypto');
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const { createPresignedPutObject, isObjectStorageConfigured, EXT_BY_TYPE } = require('../utils/objectStoragePresign');

const ADMIN_SCOPES = new Set(['product', 'category']);

/** POST /uploads/presign — { scope: "product"|"category", contentType, fileSize? } — ADMIN hoặc MODERATOR */
router.post(
    '/presign',
    checkLogin,
    CheckPermission('ADMIN', 'MODERATOR'),
    async function (req, res) {
        try {
            if (!isObjectStorageConfigured()) {
                return res.status(503).json({ message: 'AVATAR_STORAGE_NOT_CONFIGURED', code: 'AVATAR_STORAGE_NOT_CONFIGURED' });
            }

            const scope = String(req.body.scope || '').trim();
            if (!ADMIN_SCOPES.has(scope)) {
                return res.status(400).json({ message: 'INVALID_UPLOAD_SCOPE', code: 'INVALID_UPLOAD_SCOPE' });
            }

            const contentType = req.body.contentType !== undefined ? req.body.contentType : req.body.content_type;
            const fileSizeRaw = req.body.fileSize !== undefined ? req.body.fileSize : req.body.file_size;
            const fileSize = fileSizeRaw !== undefined && fileSizeRaw !== null ? Number(fileSizeRaw) : undefined;

            const ct = String(contentType || '').trim();
            const ext = EXT_BY_TYPE[ct];
            if (!ext) {
                return res.status(400).json({ message: 'INVALID_IMAGE_CONTENT_TYPE', code: 'INVALID_IMAGE_CONTENT_TYPE' });
            }

            const userId = req.user.id;
            const prefix = scope === 'product' ? 'products' : 'categories';
            const key = `${prefix}/${userId}/${crypto.randomUUID()}.${ext}`;

            const result = await createPresignedPutObject({ key, contentType: ct, fileSize });
            res.json(result);
        } catch (err) {
            if (err.code === 'NOT_CONFIGURED') {
                return res.status(503).json({ message: err.message, code: 'AVATAR_STORAGE_NOT_CONFIGURED' });
            }
            if (err.code === 'VALIDATION') {
                return res.status(400).json({ message: err.message, code: err.message });
            }
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = router;
