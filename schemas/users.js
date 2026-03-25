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
        phone: String,
        gender: String,
        date_of_birth: Date,
        default_address: String,
        avatar_url: String,
        role: { type: String, enum: ['USER', 'ADMIN', 'MODERATOR'], default: 'USER' }
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
        const doc = await UserModel.findOne({ id: Number(id) }).select('-password_hash').lean();
        return stripDoc(doc);
    },

    async findByIdWithPassword(id) {
        const doc = await UserModel.findOne({ id: Number(id) }).lean();
        return stripDoc(doc);
    },

    async findOne(conditions) {
        const c = { ...conditions };
        if (c.email) {
            c.email = String(c.email).toLowerCase().trim();
        }
        const doc = await UserModel.findOne(c).lean();
        return stripDoc(doc);
    },

    async find(conditions = {}) {
        const docs = await UserModel.find(conditions).select('-password_hash').lean();
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

    async delete(id) {
        const r = await UserModel.deleteOne({ id: Number(id) });
        return r.deletedCount > 0;
    }
};

module.exports = User;
