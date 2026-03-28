const User = require('../schemas/users');

module.exports = {
    async CreateAnUser(name, password, email) {
        return await User.create({ name, password_hash: password, email });
    },

    async FindByEmail(email) {
        return await User.findOne({ email });
    },

    async FindByPasswordResetHash(tokenHash) {
        return await User.findByPasswordResetHash(tokenHash);
    },

    async FindById(id) {
        return await User.findById(id);
    },

    async FindByIdWithPassword(id) {
        return await User.findByIdWithPassword(id);
    },

    async GetAllUser(conditions) {
        return await User.find(conditions);
    },

    async UpdateUser(id, data) {
        return await User.update(id, data);
    },

    async DeleteUser(id, deletedBy) {
        return await User.delete(id, deletedBy);
    }
};
