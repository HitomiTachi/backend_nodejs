const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
    {
        productId: { type: Number, required: true },
        productName: { type: String, required: true },
        productImage: { type: String, default: null },
        quantity: { type: Number, required: true },
        /** Đơn giá GROSS (đã gồm VAT) tại thời điểm đặt — khớp storefront */
        priceAtOrder: { type: Number, required: true },
        taxGroup: { type: String, default: null },
        taxRate: { type: Number, default: null },
        taxAmount: { type: Number, default: null },
        priceBasis: { type: String, enum: ['GROSS', 'NET'], default: 'GROSS' },
        lineGross: { type: Number, default: null },
        lineDiscount: { type: Number, default: null }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        userId: { type: Number, required: true, index: true },
        /** Tổng tiền hàng (GROSS) trước giảm giá */
        subtotal: { type: Number, default: null },
        totalTax: { type: Number, default: null },
        discountTotal: { type: Number, default: null },
        couponCode: { type: String, default: null },
        couponId: { type: Number, default: null },
        /** Phí vận chuyển do server tính (snapshot). */
        shippingFee: { type: Number, default: null },
        /** Tổng khách trả: tiền hàng sau giảm + phí ship (đã gồm VAT trong giá hàng). */
        totalPrice: { type: Number, required: true },
        status: { type: String, default: 'PENDING' },
        /** Thanh toán: UNPAID | PENDING | PAID | FAILED | CANCELLED | EXPIRED */
        paymentStatus: {
            type: String,
            enum: ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
            default: 'UNPAID'
        },
        /** Cổng thanh toán đã chọn, ví dụ: MOMO. */
        paymentMethod: { type: String, default: null },
        /** Gateway order id/request id để đối soát callback từ cổng. */
        paymentGatewayOrderId: { type: String, default: null, index: true },
        paymentRequestId: { type: String, default: null },
        /** Mã giao dịch từ cổng khi thanh toán thành công. */
        paymentTransactionId: { type: String, default: null },
        paidAt: { type: Date, default: null },
        paymentFailureReason: { type: String, default: null },
        /** Lưu metadata cổng (payUrl, deeplink, qrCodeUrl, ipn trace...). */
        paymentMeta: { type: mongoose.Schema.Types.Mixed, default: null },
        /** Snapshot địa chỉ giao hàng tại thời điểm đặt (một chuỗi đầy đủ). */
        shippingAddress: { type: String, default: null },
        items: [orderItemSchema]
    },
    { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
