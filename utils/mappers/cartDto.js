/**
 * CartItem[] — docs/TECHHOME_BACKEND_API_SPEC.md §5.6
 */

const Product = require('../../schemas/products');
const CartModel = require('../../schemas/carts');

function effectiveUnitPrice(row) {
    if (!row) return 0;
    const price = row.price != null ? Number(row.price) : 0;
    const saleRaw = row.salePrice != null ? row.salePrice : row.old_price;
    const saleNum = saleRaw != null ? Number(saleRaw) : null;
    if (saleNum != null && saleNum < price) return saleNum;
    return price;
}

async function toCartItemDto(subDoc, product) {
    const qty = Math.max(1, Math.floor(Number(subDoc.quantity)) || 1);
    const fallbackPrice = subDoc.price != null ? Number(subDoc.price) : 0;
    const price = product ? effectiveUnitPrice(product) : fallbackPrice;
    const name = product && product.name ? product.name : subDoc.name || '';
    const image = product && product.image ? product.image : subDoc.image || '';
    const item = {
        id: String(subDoc._id),
        productId: String(subDoc.productId),
        name,
        price,
        quantity: qty,
        image: image || ''
    };
    if (subDoc.variant != null && String(subDoc.variant).trim() !== '') {
        item.variant = String(subDoc.variant);
    }
    return item;
}

async function getCartItemsForUser(userId) {
    const uid = Number(userId);
    const cart = await CartModel.findOne({ userId: uid });
    if (!cart || !cart.items.length) {
        return [];
    }
    const out = [];
    for (const sub of cart.items) {
        const p = await Product.findById(sub.productId, { publicOnly: true });
        out.push(await toCartItemDto(sub, p));
    }
    return out;
}

module.exports = {
    effectiveUnitPrice,
    toCartItemDto,
    getCartItemsForUser
};
