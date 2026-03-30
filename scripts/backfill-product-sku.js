/**
 * One-off: đếm SKU null/rỗng/trùng; chuẩn hóa UPPERCASE; gán TH-AUTO-{id} cho thiếu;
 * gán TH-DUP-{id} cho bản ghi trùng (giữ bản có id nhỏ nhất theo nhóm).
 *
 * Chạy: node scripts/backfill-product-sku.js
 * Hoặc: npm run backfill:sku
 *
 * Yêu cầu: backup DB trước khi chạy production.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../utils/data');
const { normalizeSku } = require('../utils/sku');

// Load model theo cùng module schema (đảm bảo schema khớp app)
require('../schemas/products');

const ProductModel = mongoose.models.Product;

async function run() {
    await connectDB();
    if (!ProductModel) {
        console.error('Product model not registered');
        process.exit(1);
    }

    const all = await ProductModel.find({}).sort({ id: 1 }).lean();
    const n = all.length;
    console.log(`Total products: ${n}`);

    const emptyOrNull = all.filter((p) => p.sku == null || String(p.sku).trim() === '');
    console.log(`Missing/empty SKU: ${emptyOrNull.length}`);

    const byNorm = new Map();
    for (const p of all) {
        const raw = p.sku;
        if (raw == null || String(raw).trim() === '') continue;
        const key = normalizeSku(raw);
        if (!byNorm.has(key)) byNorm.set(key, []);
        byNorm.get(key).push(p);
    }

    let dupGroups = 0;
    for (const [, ids] of byNorm) {
        if (ids.length > 1) dupGroups += 1;
    }
    console.log(`Duplicate SKU groups (non-empty, before fix): ${dupGroups}`);

    // Pass 1: uppercase all existing non-empty
    for (const p of all) {
        if (p.sku == null || String(p.sku).trim() === '') continue;
        const nu = normalizeSku(p.sku);
        if (nu !== p.sku) {
            await ProductModel.updateOne({ id: p.id }, { $set: { sku: nu } });
            console.log(`Normalized SKU id=${p.id} -> ${nu}`);
        }
    }

    const all2 = await ProductModel.find({}).sort({ id: 1 }).lean();

    // Pass 2: fill TH-AUTO-{id}
    for (const p of all2) {
        if (p.sku == null || String(p.sku).trim() === '') {
            const auto = `TH-AUTO-${p.id}`;
            await ProductModel.updateOne({ id: p.id }, { $set: { sku: auto } });
            console.log(`Backfill id=${p.id} -> ${auto}`);
        }
    }

    const all3 = await ProductModel.find({}).sort({ id: 1 }).lean();
    const map = new Map();
    for (const p of all3) {
        const k = p.sku;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(p);
    }

    // Pass 3: resolve duplicates — keep lowest id, rename others TH-DUP-{id}
    for (const [, group] of map) {
        if (group.length <= 1) continue;
        group.sort((a, b) => a.id - b.id);
        const [, ...rest] = group;
        for (const p of rest) {
            const nu = `TH-DUP-${p.id}`;
            await ProductModel.updateOne({ id: p.id }, { $set: { sku: nu } });
            console.log(`Dedup id=${p.id} -> ${nu}`);
        }
    }

    const finalDocs = await ProductModel.find({}).lean();
    const seen = new Set();
    let ok = true;
    for (const p of finalDocs) {
        const s = p.sku;
        if (s == null || String(s).trim() === '') {
            console.error(`ERROR: still empty sku id=${p.id}`);
            ok = false;
            continue;
        }
        if (seen.has(s)) {
            console.error(`ERROR: duplicate sku=${s}`);
            ok = false;
        }
        seen.add(s);
    }

    if (ok) console.log('Verify OK: no empty SKU, no duplicates.');
    else console.error('Verify FAILED — fix manually before unique index.');

    await mongoose.disconnect();
    process.exit(ok ? 0 : 1);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
