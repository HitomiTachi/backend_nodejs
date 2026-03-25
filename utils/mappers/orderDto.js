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
    return {
        id: o.id,
        userId: o.userId,
        totalPrice: o.totalPrice,
        status: o.status,
        createdAt,
        items: (o.items || []).map(toOrderItemDto)
    };
}

module.exports = { toOrderDto, toOrderItemDto };
