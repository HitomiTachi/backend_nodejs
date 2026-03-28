/**
 * Map Mongoose / enriched rows → JSON DTO theo docs/TECHHOME_BACKEND_API_SPEC.md §5.1–§5.2
 */

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toCategoryDto(row) {
    if (!row) return null;
    const dto = {
        id: row.id,
        name: row.name,
        slug: row.slug
    };
    if (row.parent_id != null) dto.parentId = row.parent_id;
    if (row.icon != null && String(row.icon).trim() !== '') dto.icon = row.icon;
    if (row.imageUrl != null && String(row.imageUrl).trim() !== '') dto.imageUrl = row.imageUrl;
    return dto;
}

function toProductDto(row) {
    if (!row) return null;
    const price = row.price != null ? Number(row.price) : 0;
    const saleRaw = row.salePrice != null ? row.salePrice : row.old_price;
    const saleNum = saleRaw != null ? Number(saleRaw) : null;
    const salePrice = saleNum != null && saleNum < price ? saleNum : null;

    let images = null;
    if (row.images && row.images.length) {
        images = row.images;
    } else if (row.image) {
        images = [row.image];
    }

    const dto = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description != null ? row.description : null,
        image: row.image != null ? row.image : null,
        price: price,
        categoryId: row.category_id != null ? row.category_id : 0,
        categoryName: row.category_name || '',
        stock: row.stock != null ? row.stock : 0,
        featured: !!row.featured,
        specifications: row.specifications != null ? row.specifications : null
    };

    if (images) dto.images = images;
    if (salePrice != null) dto.salePrice = salePrice;
    if (row.colors && row.colors.length) dto.colors = row.colors;
    const storage = row.storageOptions || row.storage_options;
    if (storage && storage.length) dto.storageOptions = storage;
    if (row.sku != null && String(row.sku).trim() !== '') dto.sku = row.sku;
    if (row.tag != null && String(row.tag).trim() !== '') dto.tag = row.tag;

    return dto;
}

module.exports = {
    escapeRegex,
    toCategoryDto,
    toProductDto
};
