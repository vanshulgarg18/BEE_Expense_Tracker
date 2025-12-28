const mongoose = require("mongoose");
const { Schema } = mongoose;

const groupSchema = new Schema({
    name: { type: String, required: true },

    // a short unique join code
    joinCode: { 
        type: String,
        required: true,
        unique: true 
    },

    // all members who joined the group
    members: [
        { type: Schema.Types.ObjectId, ref: "User" }
    ],

    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
});

module.exports = mongoose.model("Group", groupSchema);
