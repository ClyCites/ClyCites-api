const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
});

// No need for password hashing middleware
// No need for password comparison method if not hashing

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

userSchema.add({
  refreshTokens: [refreshTokenSchema],
});

const User = mongoose.model('User', userSchema);

module.exports = User;
