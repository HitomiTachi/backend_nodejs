function normalizeStorageToken(token) {
    if (!token) return null;
    const s = String(token).trim().toUpperCase().replace(/\s+/g, '');
    const m = s.match(/^(\d+)(GB|TB)$/);
    if (!m) return null;
    return `${m[1]}${m[2]}`;
}

function uniqueStrings(items) {
    const set = new Set();
    const out = [];
    for (const item of items || []) {
        const value = String(item || '').trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (set.has(key)) continue;
        set.add(key);
        out.push(value);
    }
    return out;
}

function parseStorageOptions(name, existingStorageOptions) {
    const found = [];
    for (const item of existingStorageOptions || []) {
        const normalized = normalizeStorageToken(item);
        if (normalized) found.push(normalized);
    }
    const regex = /(\d+)\s*(GB|TB)\b/gi;
    const text = String(name || '');
    let m = regex.exec(text);
    while (m) {
        found.push(`${m[1]}${String(m[2]).toUpperCase()}`);
        m = regex.exec(text);
    }
    return uniqueStrings(found);
}

function inferBrand(name) {
    const text = String(name || '').toLowerCase();
    if (text.includes('iphone') || text.includes('ipad') || text.includes('macbook')) return 'Apple';
    if (text.includes('samsung') || text.includes('galaxy')) return 'Samsung';
    if (text.includes('xiaomi') || text.includes('redmi') || text.includes('poco')) return 'Xiaomi';
    if (text.includes('oppo')) return 'OPPO';
    if (text.includes('vivo')) return 'vivo';
    if (text.includes('realme')) return 'realme';
    if (text.includes('nokia')) return 'Nokia';
    if (text.includes('sony')) return 'Sony';
    return null;
}

function inferChip(text) {
    const s = String(text || '');
    const patterns = [
        /A\d{2}\s*Pro/i,
        /A\d{2}\s*Bionic/i,
        /Snapdragon\s*[\w\s.+-]+/i,
        /Dimensity\s*[\w\s.+-]+/i,
        /Exynos\s*[\w\s.+-]+/i,
        /Tensor\s*[\w\s.+-]+/i
    ];
    for (const re of patterns) {
        const m = s.match(re);
        if (m && m[0]) return m[0].trim();
    }
    return null;
}

function inferNumeric(text, regex) {
    const m = String(text || '').match(regex);
    if (!m || !m[1]) return null;
    const n = Number(String(m[1]).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function inferOs(text, brand) {
    const s = String(text || '').toLowerCase();
    if (s.includes('android')) return 'Android';
    if (s.includes('ios')) return 'iOS';
    if (brand === 'Apple') return 'iOS';
    return null;
}

function parseExistingSpecifications(specifications) {
    if (specifications == null || specifications === '') return {};
    if (typeof specifications === 'object') return specifications;
    try {
        const parsed = JSON.parse(String(specifications));
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (_err) {
        return { _raw: String(specifications) };
    }
    return {};
}

function buildAutoSpecPayload(product) {
    const name = String(product.name || '');
    const description = String(product.description || '');
    const text = `${name} ${description}`.trim();
    const brand = inferBrand(name);
    const chip = inferChip(text);
    const displaySizeInch = inferNumeric(text, /(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:\"|inch)\b/i);
    const refreshRateHz = inferNumeric(text, /(\d{2,3})\s*hz\b/i);
    const batteryMah = inferNumeric(text, /(\d{3,5})\s*mah\b/i);
    const ramGb = inferNumeric(text, /(\d{1,2})\s*gb\s*ram\b/i);
    const storageOptions = parseStorageOptions(name, product.storageOptions || product.storage_options);
    const colors = Array.isArray(product.colors) ? product.colors : [];

    const attributes = {};
    if (brand) attributes.brand = brand;
    if (chip) attributes.chip = chip;
    if (displaySizeInch != null) attributes.displaySizeInch = displaySizeInch;
    if (refreshRateHz != null) attributes.refreshRateHz = refreshRateHz;
    if (batteryMah != null) attributes.batteryMah = batteryMah;
    if (ramGb != null) attributes.ramGb = ramGb;
    const os = inferOs(text, brand);
    if (os) attributes.os = os;

    return {
        meta: {
            source: 'auto-enrich',
            generatedAt: new Date().toISOString(),
            version: 1
        },
        attributes,
        colors: colors,
        storageOptions: storageOptions
    };
}

function mergeSpecs(existingSpecs, autoSpecs) {
    const result = { ...existingSpecs };
    if (!result.meta || typeof result.meta !== 'object') {
        result.meta = {};
    }
    result.meta = {
        ...result.meta,
        source: autoSpecs.meta.source,
        generatedAt: autoSpecs.meta.generatedAt,
        version: autoSpecs.meta.version
    };

    const currentAttributes = result.attributes && typeof result.attributes === 'object' ? result.attributes : {};
    const autoAttributes = autoSpecs.attributes || {};
    result.attributes = { ...currentAttributes };
    for (const [key, value] of Object.entries(autoAttributes)) {
        if (result.attributes[key] == null || result.attributes[key] === '') {
            result.attributes[key] = value;
        }
    }

    if (!Array.isArray(result.storageOptions) || result.storageOptions.length === 0) {
        result.storageOptions = autoSpecs.storageOptions || [];
    }
    if (!Array.isArray(result.colors) || result.colors.length === 0) {
        result.colors = autoSpecs.colors || [];
    }

    return result;
}

function enrichProductSpecs(product) {
    const existingSpecs = parseExistingSpecifications(product.specifications);
    const autoSpecs = buildAutoSpecPayload(product);
    const merged = mergeSpecs(existingSpecs, autoSpecs);

    const nextStorageOptions =
        Array.isArray(product.storageOptions) && product.storageOptions.length
            ? product.storageOptions
            : autoSpecs.storageOptions;

    const nextColors = Array.isArray(product.colors) && product.colors.length ? product.colors : autoSpecs.colors;

    return {
        specifications: JSON.stringify(merged),
        storageOptions: nextStorageOptions,
        colors: nextColors
    };
}

module.exports = {
    enrichProductSpecs
};
