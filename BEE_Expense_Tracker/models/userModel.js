const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { 
        type: String, 
        required: true,
        minlength: [10, "Phone number must be at least 10 digits"],
        maxlength: [10, "Phone number must be exactly 10 digits"],
        match: [/^\d{10}$/, "Phone number must contain only digits"]
    }
});

module.exports = mongoose.model('User', userSchema);
