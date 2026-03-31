/**
 * Migration: chuyển dữ liệu legacy (ObjectId-based) sang schema hiện tại (numeric id).
 *
 * Chạy: node scripts/migrate-legacy-data.js
 *
 * Xử lý:
 *   - Categories: thêm `id` (Number), `parent_id` (null)
 *   - Products:   thêm `id`, `category_id` (Number map từ ObjectId), `sku` (tự sinh)
 *   - Users:      thêm `id`, rename `password` → `password_hash`, role UPPERCASE, status mapping
 */

require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/techhome';

async function migrate() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    console.log('Connected to', uri);

    // ───────────────────────── CATEGORIES ─────────────────────────
    console.log('\n=== Migrating Categories ===');
    const catCol = db.collection('categories');
    const cats = await catCol.find({}).toArray();
    const catOidToNumId = {};
    let catIdSeq = 1;
    let catUpdated = 0;

    for (const cat of cats) {
        if (cat.id != null && typeof cat.id === 'number') {
            console.log(`  [SKIP] "${cat.name}" already has id=${cat.id}`);
            catOidToNumId[String(cat._id)] = cat.id;
            if (cat.id >= catIdSeq) catIdSeq = cat.id + 1;
            continue;
        }

        const numId = catIdSeq++;
        catOidToNumId[String(cat._id)] = numId;

        const update = {
            $set: {
                id: numId,
                isDeleted: cat.isDeleted ?? false,
                deletedAt: cat.deletedAt ?? null,
                deletedBy: cat.deletedBy ?? null
            }
        };
        if (cat.parent_id === undefined) {
            update.$set.parent_id = null;
        }

        await catCol.updateOne({ _id: cat._id }, update);
        catUpdated++;
        console.log(`  [OK] "${cat.name}" → id=${numId}`);
    }
    console.log(`Categories migrated: ${catUpdated}, skipped: ${cats.length - catUpdated}`);

    // ───────────────────────── PRODUCTS ─────────────────────────
    console.log('\n=== Migrating Products ===');
    const prodCol = db.collection('products');
    const prods = await prodCol.find({}).toArray();
    let prodIdSeq = 1;
    let prodUpdated = 0;

    const existingIds = prods.filter(p => p.id != null && typeof p.id === 'number').map(p => p.id);
    if (existingIds.length > 0) {
        prodIdSeq = Math.max(...existingIds) + 1;
    }

    for (const prod of prods) {
        if (prod.id != null && typeof prod.id === 'number' && prod.category_id != null && prod.sku) {
            console.log(`  [SKIP] "${prod.name}" already migrated (id=${prod.id})`);
            continue;
        }

        const numId = (prod.id != null && typeof prod.id === 'number') ? prod.id : prodIdSeq++;
        const setFields = { id: numId };

        // Map category ObjectId → numeric category_id
        if (prod.category_id == null || typeof prod.category_id !== 'number') {
            const catRef = prod.category || prod.categoryId || prod.category_id;
            if (catRef) {
                const mapped = catOidToNumId[String(catRef)];
                if (mapped != null) {
                    setFields.category_id = mapped;
                } else {
                    setFields.category_id = 1;
                    console.log(`  [WARN] "${prod.name}" category "${catRef}" not found in map, defaulting to 1`);
                }
            } else {
                setFields.category_id = 1;
                console.log(`  [WARN] "${prod.name}" has no category reference, defaulting to 1`);
            }
        }

        // Generate SKU if missing
        if (!prod.sku) {
            const base = (prod.slug || prod.name || 'PROD')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 30);
            setFields.sku = `${base}-${String(numId).padStart(4, '0')}`;
        }

        // Migrate colors from string array to {name, hex} objects
        if (Array.isArray(prod.colors) && prod.colors.length > 0 && typeof prod.colors[0] === 'string') {
            const colorMap = {
                'Đen': '#000000', 'Trắng': '#FFFFFF', 'Xanh': '#0066CC',
                'Đỏ': '#FF0000', 'Bạc': '#C0C0C0', 'Vàng': '#FFD700',
                'Hồng': '#FF69B4', 'Xám': '#808080', 'Tím': '#800080',
            };
            setFields.colors = prod.colors.map(c => ({
                name: c,
                hex: colorMap[c] || '#888888'
            }));
        }

        // Migrate specs from object to JSON string
        if (prod.specs && typeof prod.specs === 'object' && typeof prod.specs !== 'string') {
            setFields.specifications = JSON.stringify(prod.specs);
        }

        // Ensure defaults
        if (prod.isDeleted === undefined) setFields.isDeleted = false;
        if (prod.featured === undefined) setFields.featured = prod.featured ?? false;

        await prodCol.updateOne({ _id: prod._id }, { $set: setFields });
        prodUpdated++;
        console.log(`  [OK] "${prod.name}" → id=${numId}, category_id=${setFields.category_id ?? prod.category_id}, sku=${setFields.sku ?? prod.sku}`);
    }
    console.log(`Products migrated: ${prodUpdated}, total: ${prods.length}`);

    // ───────────────────────── USERS ─────────────────────────
    console.log('\n=== Migrating Users ===');
    const userCol = db.collection('users');
    const users = await userCol.find({}).toArray();
    let userIdSeq = 1;
    let userUpdated = 0;

    const existingUserIds = users.filter(u => u.id != null && typeof u.id === 'number').map(u => u.id);
    if (existingUserIds.length > 0) {
        userIdSeq = Math.max(...existingUserIds) + 1;
    }

    for (const user of users) {
        const alreadyHasId = user.id != null && typeof user.id === 'number';
        const alreadyHasPwHash = !!user.password_hash;
        const roleIsUpper = user.role && user.role === user.role.toUpperCase();

        if (alreadyHasId && alreadyHasPwHash && roleIsUpper) {
            console.log(`  [SKIP] "${user.email}" already migrated (id=${user.id})`);
            continue;
        }

        const numId = alreadyHasId ? user.id : userIdSeq++;
        const setFields = { id: numId };

        // Rename password → password_hash
        if (!user.password_hash && user.password) {
            setFields.password_hash = user.password;
        }

        // Role uppercase
        if (user.role) {
            const upper = String(user.role).toUpperCase();
            if (['USER', 'ADMIN', 'MODERATOR'].includes(upper)) {
                setFields.role = upper;
            } else {
                setFields.role = 'USER';
            }
        } else {
            setFields.role = 'USER';
        }

        // Map isActive → status
        if (user.status === undefined && user.isActive !== undefined) {
            setFields.status = !!user.isActive;
        } else if (user.status === undefined) {
            setFields.status = true;
        }

        // Defaults
        if (user.isDeleted === undefined) setFields.isDeleted = false;
        if (user.loginCount === undefined) setFields.loginCount = 0;

        const unsetFields = {};
        if (user.password && !user.password_hash) {
            unsetFields.password = '';
        }
        if (user.isActive !== undefined) {
            unsetFields.isActive = '';
        }

        const updateOp = { $set: setFields };
        if (Object.keys(unsetFields).length > 0) {
            updateOp.$unset = unsetFields;
        }

        await userCol.updateOne({ _id: user._id }, updateOp);
        userUpdated++;
        console.log(`  [OK] "${user.email}" → id=${numId}, role=${setFields.role}`);
    }
    console.log(`Users migrated: ${userUpdated}, total: ${users.length}`);

    // ───────────────────────── INDEXES ─────────────────────────
    console.log('\n=== Ensuring indexes ===');
    try {
        await catCol.createIndex({ id: 1 }, { unique: true });
        await catCol.createIndex({ slug: 1 }, { unique: true });
        console.log('  Categories indexes OK');
    } catch (e) {
        console.log('  Categories index warning:', e.message);
    }

    try {
        await prodCol.createIndex({ id: 1 }, { unique: true });
        await prodCol.createIndex({ slug: 1 });
        await prodCol.createIndex({ sku: 1 }, { unique: true });
        console.log('  Products indexes OK');
    } catch (e) {
        console.log('  Products index warning:', e.message);
    }

    try {
        await userCol.createIndex({ id: 1 }, { unique: true });
        await userCol.createIndex({ email: 1 }, { unique: true });
        console.log('  Users indexes OK');
    } catch (e) {
        console.log('  Users index warning:', e.message);
    }

    console.log('\n=== Migration complete ===');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
