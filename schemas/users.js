const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { nextSequentialId } = require('../utils/id');

const userSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        name: String,
        email: { type: String, unique: true, index: true },
        password_hash: String,
        password_changed_at: Date,
        password_reset_token_hash: { type: String, default: null, index: true, sparse: true },
        password_reset_expires: { type: Date, default: null },
        phone: String,
        gender: String,
        date_of_birth: Date,
        default_address: String,
        avatar_url: String,
        role: { type: String, enum: ['USER', 'ADMIN', 'MODERATOR'], default: 'USER' },
        status: { type: Boolean, default: true, index: true },
        loginCount: { type: Number, default: 0 },
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: Number, default: null }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

function stripDoc(doc) {
    if (!doc) return null;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete o.__v;
    return o;
}

const User = {
    async findById(id) {
        const doc = await UserModel.findOne({
            id: Number(id),
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }).select('-password_hash').lean();
        return stripDoc(doc);
    },

    async findByIdWithPassword(id) {
        const doc = await UserModel.findOne({ id: Number(id) }).lean();
        return stripDoc(doc);
    },

    async findByPasswordResetHash(tokenHash) {
        const doc = await UserModel.findOne({
            password_reset_token_hash: tokenHash,
            password_reset_expires: { $gt: new Date() },
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }).lean();
        return stripDoc(doc);
    },

    async findOne(conditions) {
        const c = { ...conditions };
        if (c.email) {
            c.email = String(c.email).toLowerCase().trim();
        }
        if (c.includeDeleted !== true) {
            c.$and = [{ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }];
        }
        delete c.includeDeleted;
        const doc = await UserModel.findOne(c).lean();
        return stripDoc(doc);
    },

    async find(conditions = {}) {
        const q = { ...conditions };
        const includeDeleted = !!q.includeDeleted;
        if (q.includeDeleted !== undefined) delete q.includeDeleted;
        if (!includeDeleted) {
            q.$and = [{ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] }];
        }
        const docs = await UserModel.find(q).select('-password_hash').lean();
        return docs.map(stripDoc);
    },

    async create(data) {
        const id = await nextSequentialId(UserModel);
        let password_hash = data.password_hash;
        if (password_hash && !String(password_hash).startsWith('$2')) {
            const salt = bcrypt.genSaltSync(10);
            password_hash = bcrypt.hashSync(password_hash, salt);
        }
        const email = data.email ? String(data.email).toLowerCase().trim() : data.email;
        const doc = await UserModel.create({
            ...data,
            id,
            email,
            password_hash
        });
        const plain = stripDoc(doc.toObject());
        if (plain) delete plain.password_hash;
        return plain;
    },

    async update(id, data) {
        const upd = { ...data };
        if (upd.password_hash && !String(upd.password_hash).startsWith('$2')) {
            const salt = bcrypt.genSaltSync(10);
            upd.password_hash = bcrypt.hashSync(upd.password_hash, salt);
        }
        const doc = await UserModel.findOneAndUpdate({ id: Number(id) }, { $set: upd }, { new: true }).lean();
        const plain = stripDoc(doc);
        if (plain) delete plain.password_hash;
        return plain;
    },

    async delete(id, deletedBy) {
        const doc = await UserModel.findOneAndUpdate(
            { id: Number(id) },
            { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy || null, status: false } },
            { new: true }
        ).lean();
        return !!doc;
    }
};

module.exports = User;
