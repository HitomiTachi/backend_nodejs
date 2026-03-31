var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
const { checkLogin, CheckPermission } = require('../utils/authHandler');

const OrderModel = require('../schemas/orders');
require('../schemas/users');
require('../schemas/products');
const UserModel = mongoose.model('User');
const ProductModel = mongoose.model('Product');

function notDeletedFilter() {
    return {
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    };
}

router.get('/dashboard/summary', checkLogin, CheckPermission('ADMIN'), async function (req, res) {
    try {
        const [totalUsers, totalProducts, totalOrders, ordersByStatusRows, revenueRows, recentOrdersRaw] =
            await Promise.all([
                UserModel.countDocuments(notDeletedFilter()),
                ProductModel.countDocuments(notDeletedFilter()),
                OrderModel.countDocuments({}),
                OrderModel.aggregate([
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),
                OrderModel.aggregate([
                    { $match: { status: { $ne: 'CANCELLED' } } },
                    { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
                ]),
                OrderModel.find({})
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select('id userId totalPrice status createdAt')
                    .lean()
            ]);

        const ordersByStatus = {};
        for (const row of ordersByStatusRows) {
            const key = row && row._id ? String(row._id) : 'UNKNOWN';
            ordersByStatus[key] = Number(row.count || 0);
        }

        const totalRevenue = revenueRows.length > 0 ? Number(revenueRows[0].totalRevenue || 0) : 0;
        const recentOrders = recentOrdersRaw.map((order) => ({
            id: order.id,
            userId: order.userId,
            totalPrice: order.totalPrice,
            status: order.status,
            createdAt: order.createdAt
        }));

        res.json({
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
            ordersByStatus,
            recentOrders
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
