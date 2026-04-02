/**
 * Report nhanh cac don thanh toan MOMO dang PENDING qua nguong thoi gian.
 *
 * Chay:
 *   node scripts/momo-pending-report.js
 *   node scripts/momo-pending-report.js 45
 *   npm run momo:pending:report -- 45
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../utils/data');
const OrderModel = require('../schemas/orders');

function parseMinutesArg() {
    const cli = process.argv[2];
    if (cli != null && String(cli).trim() !== '') {
        const n = parseInt(String(cli), 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    const envRaw = process.env.MOMO_PENDING_ALERT_MINUTES;
    if (envRaw != null && String(envRaw).trim() !== '') {
        const n = parseInt(String(envRaw), 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 30;
}

async function run() {
    await connectDB();
    const minutes = parseMinutesArg();
    const threshold = new Date(Date.now() - minutes * 60 * 1000);

    const rows = await OrderModel.find({
        paymentMethod: 'MOMO',
        paymentStatus: 'PENDING',
        createdAt: { $lte: threshold }
    })
        .sort({ createdAt: 1 })
        .lean();

    console.log(`MOMO pending report (>${minutes}m): ${rows.length} order(s)`);
    if (rows.length > 0) {
        console.log('orderId | userId | totalPrice | createdAt | paymentGatewayOrderId');
        for (const row of rows) {
            console.log(
                `${row.id} | ${row.userId} | ${row.totalPrice} | ${new Date(row.createdAt).toISOString()} | ${row.paymentGatewayOrderId || '-'}`
            );
        }
    }

    await mongoose.disconnect();
    process.exit(0);
}

run().catch(async (err) => {
    console.error('momo-pending-report failed:', err && err.message ? err.message : err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});
