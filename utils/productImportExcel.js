const slugify = require('slugify');
const ExcelJS = require('exceljs');
const Product = require('../schemas/products');
const Inventory = require('../schemas/inventories');
const Category = require('../schemas/categories');
const { normalizeSku, validateSkuInput } = require('./sku');

const MAX_ROWS = 500;

function normalizeHeader(cell) {
    return String(cell ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
}

/**
 * Sheet đầu tiên hoặc sheet tên "Products" (không phân biệt hoa thường).
 * Dòng 1 = header: sku, name, price, categoryId (khuyến nghị thêm stock, description).
 */
function pickWorksheet(workbook) {
    const byName = workbook.worksheets.find((ws) => ws.name && ws.name.trim().toLowerCase() === 'products');
    return byName || workbook.worksheets[0];
}

function mapHeaderRow(row) {
    const map = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
        const raw = cell.text != null && String(cell.text).trim() !== '' ? cell.text : cell.value;
        const key = normalizeHeader(raw);
        if (key) map[key] = col;
    });
    return map;
}

function rowHasContent(row) {
    let ok = false;
    row.eachCell({ includeEmpty: false }, () => {
        ok = true;
    });
    return ok;
}

async function rowToPayload(worksheet, rowNumber, colMap) {
    const row = worksheet.getRow(rowNumber);
    const get = (aliases) => {
        for (const a of aliases) {
            const c = colMap[normalizeHeader(a)];
            if (c != null) {
                const cell = row.getCell(c);
                const v = cell.value;
                if (v == null) return '';
                if (typeof v === 'object' && v != null && 'text' in v) return String(v.text ?? '').trim();
                if (typeof v === 'object' && v != null && 'result' in v) return String(v.result ?? '').trim();
                return String(v).trim();
            }
        }
        return '';
    };

    const skuRaw = get(['sku']);
    const name = get(['name', 'tên', 'ten']);
    const priceRaw = get(['price', 'giá', 'gia']);
    const catRaw = get(['categoryid', 'category_id', 'danhmuc', 'category']);
    const stockRaw = get(['stock', 'tồn', 'ton']);
    const description = get(['description', 'mô tả', 'mo ta', 'desc']) || '';

    const err = validateSkuInput(skuRaw);
    if (err) return { error: err };

    if (!name) return { error: 'name is required' };
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) return { error: 'price must be a non-negative number' };

    const categoryId = Number(catRaw);
    if (!Number.isFinite(categoryId)) return { error: 'categoryId must be a number' };

    const cat = await Category.findById(categoryId);
    if (!cat) return { error: `categoryId ${categoryId} not found` };

    let stock = 0;
    if (stockRaw !== '') {
        const s = Number(stockRaw);
        if (!Number.isFinite(s) || s < 0) return { error: 'stock must be a non-negative number' };
        stock = Math.floor(s);
    }

    const sku = normalizeSku(skuRaw);
    const slug = slugify(name, { replacement: '-', lower: true, locale: 'vi' });

    return {
        payload: {
            name,
            slug,
            price,
            category_id: categoryId,
            description,
            sku,
            stock
        }
    };
}

/**
 * @returns {Promise<{ imported: number, errors: { row: number, message: string }[] }>}
 */
async function importProductsFromBuffer(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = pickWorksheet(workbook);
    if (!ws) {
        return { imported: 0, errors: [{ row: 0, message: 'No worksheet in file' }] };
    }

    const headerRow = ws.getRow(1);
    const colMap = mapHeaderRow(headerRow);
    const requiredCols = ['sku', 'name', 'price', 'categoryid'];
    const missing = requiredCols.filter((k) => !Object.keys(colMap).includes(k));
    if (missing.length) {
        return {
            imported: 0,
            errors: [
                {
                    row: 1,
                    message: `Missing required columns: ${missing.join(', ')}. Need: sku, name, price, categoryId`
                }
            ]
        };
    }

    let dataRowCount = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
        if (rowHasContent(ws.getRow(r))) dataRowCount += 1;
    }
    if (dataRowCount > MAX_ROWS) {
        return {
            imported: 0,
            errors: [{ row: 0, message: `Too many data rows: ${dataRowCount} (max ${MAX_ROWS})` }]
        };
    }

    const errors = [];
    let imported = 0;
    const rowCount = ws.rowCount;

    for (let r = 2; r <= rowCount; r++) {
        const row = ws.getRow(r);
        if (!rowHasContent(row)) continue;

        const parsed = await rowToPayload(ws, r, colMap);
        if (parsed.error) {
            errors.push({ row: r, message: parsed.error });
            continue;
        }

        const { payload } = parsed;
        const existing = await Product.findOneBySku(payload.sku);
        if (existing) {
            errors.push({ row: r, message: `SKU already exists: ${payload.sku}` });
            continue;
        }

        try {
            const created = await Product.create(payload);
            await Inventory.ensureForProduct(created.id);
            imported += 1;
        } catch (e) {
            if (e && e.code === 11000) {
                errors.push({ row: r, message: `Duplicate SKU: ${payload.sku}` });
            } else {
                errors.push({ row: r, message: e.message || String(e) });
            }
        }
    }

    return { imported, errors };
}

module.exports = {
    MAX_ROWS,
    importProductsFromBuffer
};
