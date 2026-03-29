/**
 * Parse & validate admin coupon payloads — aligned with `schemas/coupons.js` and `orderPricing.js`.
 */

function mapToCouponType(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim().toUpperCase();
    if (s === 'PERCENT' || s === 'FIXED') return s;
    const lower = String(raw).trim().toLowerCase();
    if (lower === 'percent') return 'PERCENT';
    if (lower === 'fixed') return 'FIXED';
    return null;
}

function pickType(body) {
    const fromDiscount = mapToCouponType(body.discountType);
    if (fromDiscount) return fromDiscount;
    return mapToCouponType(body.type);
}

function parseDateOrNull(v) {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
        const err = new Error('Ngay khong hop le');
        err.status = 400;
        throw err;
    }
    return d;
}

function parseNumberArray(v) {
    if (v == null) return undefined;
    if (!Array.isArray(v)) {
        const err = new Error('Danh sach id phai la mang');
        err.status = 400;
        throw err;
    }
    return v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

/**
 * @param {object} body
 * @param {object} [existing] lean coupon doc for PATCH
 * @param {{ partial: boolean }} opts
 * @returns {object} fields to assign to mongoose doc
 */
function buildCouponFieldsFromBody(body, existing, opts) {
    const partial = Boolean(opts && opts.partial);
    const out = {};

    if (!partial || body.code !== undefined) {
        if (!partial && (body.code == null || String(body.code).trim() === '')) {
            const err = new Error('Ma voucher bat buoc');
            err.status = 400;
            throw err;
        }
        if (body.code !== undefined) {
            out.code = String(body.code).trim().toUpperCase();
        }
    }

    const type = pickType(body);
    if (!partial) {
        if (!type) {
            const err = new Error('Loai giam gia bat buoc (PERCENT hoac FIXED / percent hoac fixed)');
            err.status = 400;
            throw err;
        }
        out.type = type;
    } else if (type) {
        out.type = type;
    }

    if (!partial || body.value !== undefined) {
        const val = body.value != null ? Number(body.value) : NaN;
        if (!partial && !Number.isFinite(val)) {
            const err = new Error('Gia tri giam gia bat buoc');
            err.status = 400;
            throw err;
        }
        if (body.value !== undefined) {
            out.value = val;
        }
    }

    if (body.minOrderAmount !== undefined) {
        out.minOrderAmount = Math.max(0, Number(body.minOrderAmount) || 0);
    } else if (!partial) {
        out.minOrderAmount = 0;
    }

    if (body.maxDiscountAmount !== undefined) {
        const m = body.maxDiscountAmount;
        out.maxDiscountAmount = m == null || m === '' ? null : Math.max(0, Number(m));
    }

    const validFromRaw = body.validFrom !== undefined ? body.validFrom : undefined;
    const validToRaw =
        body.validTo !== undefined
            ? body.validTo
            : body.expiresAt !== undefined
              ? body.expiresAt
              : undefined;

    if (validFromRaw !== undefined) {
        out.validFrom = validFromRaw == null || validFromRaw === '' ? null : parseDateOrNull(validFromRaw);
    }
    if (validToRaw !== undefined) {
        out.validTo = validToRaw == null || validToRaw === '' ? null : parseDateOrNull(validToRaw);
    }

    const limitRaw = body.usageLimit !== undefined ? body.usageLimit : body.maxUses;
    if (limitRaw !== undefined) {
        const n = Number(limitRaw);
        out.usageLimit = !Number.isFinite(n) || n <= 0 ? null : Math.floor(n);
    } else if (!partial) {
        out.usageLimit = null;
    }

    if (body.perUserLimit !== undefined) {
        const n = Number(body.perUserLimit);
        out.perUserLimit = !Number.isFinite(n) || n <= 0 ? null : Math.floor(n);
    } else if (!partial) {
        out.perUserLimit = null;
    }

    if (body.active !== undefined) {
        out.active = Boolean(body.active);
    } else if (!partial) {
        out.active = true;
    }

    if (body.excludedProductIds !== undefined) {
        out.excludedProductIds = parseNumberArray(body.excludedProductIds) || [];
    } else if (!partial) {
        out.excludedProductIds = [];
    }

    if (body.applicableCategoryIds !== undefined) {
        out.applicableCategoryIds = parseNumberArray(body.applicableCategoryIds) || [];
    } else if (!partial) {
        out.applicableCategoryIds = [];
    }

    return out;
}

/**
 * Validate merged coupon fields (after build + merge with existing for PATCH).
 * @param {object} doc — plain object with type, value, validFrom, validTo, usageLimit, perUserLimit
 */
function assertCouponBusinessRules(doc) {
    const type = doc.type;
    const value = Number(doc.value);
    if (!Number.isFinite(value)) {
        const err = new Error('Gia tri khong hop le');
        err.status = 400;
        throw err;
    }
    if (type === 'PERCENT') {
        if (value < 0 || value > 100) {
            const err = new Error('Phan tram giam phai tu 0 den 100');
            err.status = 400;
            throw err;
        }
    } else if (type === 'FIXED') {
        if (value < 0) {
            const err = new Error('So tien giam phai >= 0');
            err.status = 400;
            throw err;
        }
    }

    const vf = doc.validFrom ? new Date(doc.validFrom) : null;
    const vt = doc.validTo ? new Date(doc.validTo) : null;
    if (vf && vt && vf.getTime() > vt.getTime()) {
        const err = new Error('validFrom phai truoc hoac bang validTo');
        err.status = 400;
        throw err;
    }

    if (doc.usageLimit != null && doc.usageLimit < 1) {
        const err = new Error('usageLimit phai >= 1 hoac de trong');
        err.status = 400;
        throw err;
    }
    if (doc.perUserLimit != null && doc.perUserLimit < 1) {
        const err = new Error('perUserLimit phai >= 1 hoac de trong');
        err.status = 400;
        throw err;
    }
}

/**
 * @param {object} body
 * @param {{ partial: boolean }} opts
 */
function parseCouponBody(body, opts) {
    return buildCouponFieldsFromBody(body, null, opts);
}

/**
 * Merge PATCH fields onto existing lean doc and validate.
 * @param {object} existing lean
 * @param {object} patchFields from buildCouponFieldsFromBody
 */
function mergeCouponForValidation(existing, patchFields) {
    return {
        type: patchFields.type !== undefined ? patchFields.type : existing.type,
        value: patchFields.value !== undefined ? patchFields.value : existing.value,
        validFrom:
            patchFields.validFrom !== undefined ? patchFields.validFrom : existing.validFrom,
        validTo: patchFields.validTo !== undefined ? patchFields.validTo : existing.validTo,
        usageLimit:
            patchFields.usageLimit !== undefined ? patchFields.usageLimit : existing.usageLimit,
        perUserLimit:
            patchFields.perUserLimit !== undefined ? patchFields.perUserLimit : existing.perUserLimit,
        minOrderAmount:
            patchFields.minOrderAmount !== undefined
                ? patchFields.minOrderAmount
                : existing.minOrderAmount,
        maxDiscountAmount:
            patchFields.maxDiscountAmount !== undefined
                ? patchFields.maxDiscountAmount
                : existing.maxDiscountAmount
    };
}

function mergeAndValidateCoupon(existing, patchFields) {
    const merged = mergeCouponForValidation(existing, patchFields);
    assertCouponBusinessRules(merged);
    return merged;
}

function validateNewCoupon(fields) {
    assertCouponBusinessRules(fields);
}

module.exports = {
    parseCouponBody,
    buildCouponFieldsFromBody,
    mergeCouponForValidation,
    mergeAndValidateCoupon,
    validateNewCoupon,
    assertCouponBusinessRules
};
