const User = require('../schemas/users');

module.exports = {
    async CreateAnUser(name, password, email) {
        return await User.create({ name, password_hash: password, email });
    },

    async FindByEmail(email) {
        return await User.findOne({ email });
    },

    async FindById(id) {
        return await User.findById(id);
    },

    async FindByIdWithPassword(id) {
        return await User.findByIdWithPassword(id);
    },

    async GetAllUser() {
        return await User.find();
    },

    async UpdateUser(id, data) {
        return await User.update(id, data);
    },

    async DeleteUser(id) {
        return await User.delete(id);
    }
};
