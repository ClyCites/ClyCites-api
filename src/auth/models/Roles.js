const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    permissions: {
        type: [String],
        required: true
    }
});

const Role = mongoose.model('Role', RoleSchema);

module.exports = Role;
