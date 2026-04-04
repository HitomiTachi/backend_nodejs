var express = require('express');
var router = express.Router();
const CouponModel = require('../schemas/coupons');
const CouponRedemptionModel = require('../schemas/couponRedemptions');
const { checkLogin, CheckPermission } = require('../utils/authHandler');
const { nextSequentialId } = require('../utils/id');
const {
    buildCouponFieldsFromBody,
    mergeAndValidateCoupon,
    validateNewCoupon
} = require('../utils/couponPayload');
const { toCouponAdminDto } = require('../utils/mappers/couponAdminDto');
const { deactivateExpiredCoupons } = require('../utils/couponExpirySync');

function isDuplicateKeyError(err) {
    return err && (err.code === 11000 || err.code === 11001);
}

async function usedCountsByCouponIds(ids) {
    if (!ids || ids.length === 0) {
        return new Map();
    }
    const rows = await CouponRedemptionModel.aggregate([
        { $match: { couponId: { $in: ids } } },
        { $group: { _id: '$couponId', count: { $sum: 1 } } }
    ]);
    const m = new Map();
    for (const id of ids) {
        m.set(id, 0);
    }
    for (const r of rows) {
        m.set(r._id, r.count);
    }
    return m;
}

function parsePositiveInt(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.floor(n);
}

router.get('/', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const page = parsePositiveInt(req.query.page, 1);
        const size = Math.min(100, parsePositiveInt(req.query.size, 50));
        const skip = (page - 1) * size;

        const filter = {};
        const activeQ = req.query.active;
        if (activeQ === 'true') filter.active = true;
        else if (activeQ === 'false') filter.active = false;

        const q = req.query.q != null ? String(req.query.q).trim() : '';
        if (q) {
            filter.code = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        }

        const [total, list] = await Promise.all([
            CouponModel.countDocuments(filter),
            CouponModel.find(filter).sort({ id: -1 }).skip(skip).limit(size).lean()
        ]);

        const ids = list.map((c) => c.id);
        const counts = await usedCountsByCouponIds(ids);
        const data = list.map((c) => toCouponAdminDto(c, counts.get(c.id) || 0));

        res.json({
            items: data,
            total,
            page,
            size
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    }
});

router.get('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        await deactivateExpiredCoupons();
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id < 1) {
            return res.status(400).json({ message: 'ID khong hop le' });
        }
        const doc = await CouponModel.findOne({ id }).lean();
        if (!doc) {
            return res.status(404).json({ message: 'NOT FOUND' });
        }
        const used = await CouponRedemptionModel.countDocuments({ couponId: id });
        res.json(toCouponAdminDto(doc, used));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    }
});

router.post('/', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const fields = buildCouponFieldsFromBody(req.body, null, { partial: false });
        validateNewCoupon(fields);

        const newId = await nextSequentialId(CouponModel);
        const created = await CouponModel.create({
            id: newId,
            ...fields
        });
        const lean = created.toObject();
        res.status(201).json(toCouponAdminDto(lean, 0));
    } catch (err) {
        if (isDuplicateKeyError(err)) {
            return res.status(400).json({ message: 'Ma voucher da ton tai' });
        }
        res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    }
});

router.patch('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id < 1) {
            return res.status(400).json({ message: 'ID khong hop le' });
        }
        const existing = await CouponModel.findOne({ id }).lean();
        if (!existing) {
            return res.status(404).json({ message: 'NOT FOUND' });
        }

        const patch = buildCouponFieldsFromBody(req.body, existing, { partial: true });
        mergeAndValidateCoupon(existing, patch);

        const updated = await CouponModel.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean();
        const used = await CouponRedemptionModel.countDocuments({ couponId: id });
        res.json(toCouponAdminDto(updated, used));
    } catch (err) {
        if (isDuplicateKeyError(err)) {
            return res.status(400).json({ message: 'Ma voucher da ton tai' });
        }
        res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    }
});

/** Vo hieu hoa (soft): active = false — giu lich su don hang. */
router.delete('/:id', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id < 1) {
            return res.status(400).json({ message: 'ID khong hop le' });
        }
        const existing = await CouponModel.findOneAndUpdate(
            { id },
            { $set: { active: false } },
            { new: true }
        ).lean();
        if (!existing) {
            return res.status(404).json({ message: 'NOT FOUND' });
        }
        const used = await CouponRedemptionModel.countDocuments({ couponId: id });
        res.json(toCouponAdminDto(existing, used));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    }
});

module.exports = router;
