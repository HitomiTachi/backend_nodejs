const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/techhome';

function connectDB() {
    mongoose.connection.on('connected', function () {
        console.log('MongoDB connected');
    });
    mongoose.connection.on('disconnected', function () {
        console.log('MongoDB disconnected');
    });
    return mongoose.connect(uri);
}

module.exports = {
    mongoose,
    connectDB
};
