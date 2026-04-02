/**
 * OrderDto — docs/TECHHOME_BACKEND_API_SPEC.md §5.5
 */

function toOrderItemDto(row) {
    const item = {
        productId: row.productId,
        productName: row.productName,
        quantity: row.quantity,
        priceAtOrder: row.priceAtOrder
    };
    if (row.productImage != null && row.productImage !== '') {
        item.productImage = row.productImage;
    } else {
        item.productImage = null;
    }
    if (row.taxGroup != null && row.taxGroup !== '') {
        item.taxGroup = row.taxGroup;
    }
    if (row.taxRate != null && Number.isFinite(Number(row.taxRate))) {
        item.taxRate = Number(row.taxRate);
    }
    if (row.taxAmount != null && Number.isFinite(Number(row.taxAmount))) {
        item.taxAmount = Number(row.taxAmount);
    }
    if (row.priceBasis != null) {
        item.priceBasis = row.priceBasis;
    }
    if (row.lineGross != null && Number.isFinite(Number(row.lineGross))) {
        item.lineGross = Number(row.lineGross);
    }
    if (row.lineDiscount != null && Number.isFinite(Number(row.lineDiscount)) && Number(row.lineDiscount) > 0) {
        item.lineDiscount = Number(row.lineDiscount);
    }
    return item;
}

function toOrderDto(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    let createdAt = o.createdAt;
    if (createdAt instanceof Date) {
        createdAt = createdAt.toISOString();
    } else if (typeof createdAt !== 'string') {
        createdAt = new Date().toISOString();
    }
    const dto = {
        id: o.id,
        userId: o.userId,
        totalPrice: o.totalPrice,
        status: o.status,
        createdAt,
        items: (o.items || []).map(toOrderItemDto)
    };
    if (o.subtotal != null && Number.isFinite(Number(o.subtotal))) {
        dto.subtotal = Number(o.subtotal);
    }
    if (o.totalTax != null && Number.isFinite(Number(o.totalTax))) {
        dto.totalTax = Number(o.totalTax);
    }
    if (o.discountTotal != null && Number.isFinite(Number(o.discountTotal)) && Number(o.discountTotal) > 0) {
        dto.discountTotal = Number(o.discountTotal);
    }
    if (o.couponCode != null && String(o.couponCode).trim() !== '') {
        dto.couponCode = String(o.couponCode).trim();
    }
    if (o.couponId != null && Number.isFinite(Number(o.couponId))) {
        dto.couponId = Number(o.couponId);
    }
    if (o.shippingFee != null && Number.isFinite(Number(o.shippingFee))) {
        dto.shippingFee = Number(o.shippingFee);
    }
    if (o.shippingAddress != null && String(o.shippingAddress).trim() !== '') {
        dto.shippingAddress = String(o.shippingAddress).trim();
    } else {
        dto.shippingAddress = null;
    }
    if (o.paymentMethod != null && String(o.paymentMethod).trim() !== '') {
        dto.paymentMethod = String(o.paymentMethod).trim();
    }
    if (o.paymentStatus != null && String(o.paymentStatus).trim() !== '') {
        dto.paymentStatus = String(o.paymentStatus).trim();
    }
    if (o.paymentGatewayOrderId != null && String(o.paymentGatewayOrderId).trim() !== '') {
        dto.paymentGatewayOrderId = String(o.paymentGatewayOrderId).trim();
    }
    if (o.paymentRequestId != null && String(o.paymentRequestId).trim() !== '') {
        dto.paymentRequestId = String(o.paymentRequestId).trim();
    }
    if (o.paymentTransactionId != null && String(o.paymentTransactionId).trim() !== '') {
        dto.paymentTransactionId = String(o.paymentTransactionId).trim();
    }
    if (o.paidAt != null) {
        const paidAt = o.paidAt instanceof Date ? o.paidAt.toISOString() : String(o.paidAt);
        dto.paidAt = paidAt;
    }
    if (o.paymentFailureReason != null && String(o.paymentFailureReason).trim() !== '') {
        dto.paymentFailureReason = String(o.paymentFailureReason).trim();
    }
    return dto;
}

module.exports = { toOrderDto, toOrderItemDto };
