var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var multer = require('multer');
const { checkLogin } = require('../utils/authHandler');
const userController = require('../controllers/users');
const Product = require('../schemas/products');
const MessageModel = require('../schemas/messages');
const { nextSequentialId } = require('../utils/id');
const {
    normalizeRole,
    isStaffRole,
    resolveSupportAdminUserId
} = require('../utils/supportChat');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'messages');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname || '') || '.bin';
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

async function userMini(id) {
    const u = await userController.FindById(id);
    if (!u) {
        return { id: Number(id) };
    }
    return { id: u.id, name: u.name, email: u.email };
}

async function enrichMessages(docs) {
    const list = Array.isArray(docs) ? docs : [];
    const out = [];
    for (const m of list) {
        const plain = typeof m.toObject === 'function' ? m.toObject() : { ...m };
        const [from, to] = await Promise.all([userMini(plain.fromUserId), userMini(plain.toUserId)]);
        out.push({
            id: plain.id,
            from,
            to,
            messageContent: plain.messageContent,
            contextType: plain.contextType || 'GENERAL',
            productId: plain.productId != null ? plain.productId : null,
            productNameSnapshot: plain.productNameSnapshot != null ? plain.productNameSnapshot : null,
            createdAt: plain.createdAt,
            updatedAt: plain.updatedAt
        });
    }
    return out;
}

/** Meta: id admin hỗ trợ (khách chat với đây). */
router.get('/meta/support', checkLogin, async function (req, res) {
    try {
        const supportUserId = await resolveSupportAdminUserId();
        if (supportUserId == null) {
            return res.status(503).json({ message: 'Chua cau hinh tai khoan admin ho tro' });
        }
        const staff = isStaffRole(req.user.role);
        res.json({
            supportUserId,
            isStaff: staff,
            label: 'Ho tro san pham / Gop y'
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Loi server' });
    }
});

/** Danh sách hội thoại — đặt trước /:userId */
router.get('/', checkLogin, async function (req, res) {
    try {
        const me = req.user.id;
        const myStaff = isStaffRole(req.user.role);
        const supportId = await resolveSupportAdminUserId();

        const messages = await MessageModel.find({
            $or: [{ fromUserId: me }, { toUserId: me }]
        })
            .sort({ createdAt: -1 })
            .lean();

        const map = new Map();
        for (const m of messages) {
            const other = m.fromUserId === me ? m.toUserId : m.fromUserId;
            if (!myStaff) {
                if (supportId != null && other !== supportId) {
                    continue;
                }
            } else {
                const otherUser = await userController.FindById(other);
                if (!otherUser || isStaffRole(otherUser.role)) {
                    continue;
                }
            }
            const key = String(other);
            if (!map.has(key)) {
                map.set(key, m);
            }
        }

        const result = [];
        for (const [userKey, last] of map) {
            const [enriched] = await enrichMessages([last]);
            result.push({
                user: userKey,
                message: enriched
            });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Loi server' });
    }
});

/** POST — JSON { to, text } hoặc multipart field file (+ to). */
router.post('/', checkLogin, function (req, res, next) {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('multipart/form-data')) {
        return upload.single('file')(req, res, next);
    }
    next();
});

router.post('/', checkLogin, async function (req, res) {
    try {
        const me = req.user.id;
        const myStaff = isStaffRole(req.user.role);
        const supportId = await resolveSupportAdminUserId();
        if (supportId == null) {
            return res.status(503).json({ message: 'Chua cau hinh tai khoan admin ho tro' });
        }

        let toUserId;
        const toRaw = req.body.to != null ? req.body.to : req.body.toUserId;
        if (myStaff) {
            toUserId = parseInt(String(toRaw), 10);
            if (Number.isNaN(toUserId) || toUserId < 1) {
                return res.status(400).json({ message: 'to (user id khach) la bat buoc' });
            }
        } else {
            toUserId = supportId;
            if (toRaw != null && String(toRaw).trim() !== '') {
                const forced = parseInt(String(toRaw), 10);
                if (!Number.isNaN(forced) && forced !== supportId) {
                    return res.status(403).json({ message: 'Chi co the nhan tin toi ho tro (admin)' });
                }
            }
        }

        if (toUserId === me) {
            return res.status(400).json({ message: 'Khong gui tin nhan cho chinh minh' });
        }

        const peer = await userController.FindById(toUserId);
        if (!peer) {
            return res.status(404).json({ message: 'Nguoi nhan khong ton tai' });
        }

        if (myStaff && isStaffRole(peer.role)) {
            return res.status(403).json({ message: 'Chi nhan tin toi khach (USER)' });
        }
        if (!myStaff && !isStaffRole(peer.role)) {
            return res.status(403).json({ message: 'Nguoi nhan phai la ho tro' });
        }

        let contextType = 'GENERAL';
        let productId = null;
        let productNameSnapshot = null;
        const productRaw = req.body.productId != null ? req.body.productId : req.body.product_id;
        if (productRaw != null && String(productRaw).trim() !== '') {
            const pid = parseInt(String(productRaw), 10);
            if (!Number.isNaN(pid) && pid >= 1) {
                const prod = await Product.findById(pid, { publicOnly: !myStaff });
                if (!prod || prod.isDeleted === true) {
                    return res.status(404).json({ message: 'San pham khong ton tai' });
                }
                contextType = 'PRODUCT_FEEDBACK';
                productId = pid;
                productNameSnapshot = prod.name != null ? String(prod.name).slice(0, 200) : null;
            }
        }

        let messageContent;
        if (req.file) {
            const publicPath = `/uploads/messages/${req.file.filename}`;
            messageContent = { type: 'file', text: publicPath };
        } else {
            const text = req.body.text != null ? String(req.body.text) : '';
            if (!text.trim()) {
                return res.status(400).json({ message: 'text la bat buoc (hoac gui file)' });
            }
            messageContent = { type: 'text', text: text.trim() };
        }

        const numericId = await nextSequentialId(MessageModel);
        const doc = await MessageModel.create({
            id: numericId,
            fromUserId: me,
            toUserId,
            messageContent,
            contextType,
            productId,
            productNameSnapshot
        });

        const [enriched] = await enrichMessages([doc]);
        res.status(201).json(enriched);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Loi server' });
    }
});

/** Lịch sử chat 1-1 với userId */
router.get('/:userId', checkLogin, async function (req, res) {
    try {
        const me = req.user.id;
        const myStaff = isStaffRole(req.user.role);
        const supportId = await resolveSupportAdminUserId();

        const other = parseInt(String(req.params.userId), 10);
        if (Number.isNaN(other) || other < 1) {
            return res.status(400).json({ message: 'userId khong hop le' });
        }

        const peer = await userController.FindById(other);
        if (!peer) {
            return res.status(404).json({ message: 'Nguoi dung khong ton tai' });
        }

        if (!myStaff) {
            if (supportId == null || other !== supportId) {
                return res.status(403).json({ message: 'Chi xem hop thoai voi ho tro' });
            }
        } else if (isStaffRole(peer.role)) {
            return res.status(403).json({ message: 'Khong xem thread giua staff' });
        }

        const messages = await MessageModel.find({
            $or: [
                { fromUserId: me, toUserId: other },
                { fromUserId: other, toUserId: me }
            ]
        })
            .sort({ createdAt: -1 })
            .lean();

        const enriched = await enrichMessages(messages);
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Loi server' });
    }
});

module.exports = router;
