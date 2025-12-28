const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    amount: { type: Number, required: true },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        default: null
    },

    paidBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],

    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Expense', expenseSchema);
