const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { HttpError } = require('@utils/errors');
const constants = require('@config/constants');

const saltRounds = constants.SALT_ROUNDS;

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        message: '{VALUE} is not a valid email!',
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user','guest','superadmin','company'],
      default: 'guest',
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    try {
      const hashedPassword = await bcrypt.hash(this.password, saltRounds);
      this.password = hashedPassword;
      next();
    } catch (error) {
      next(new HttpError('Could not hash password', 500));
    }
  } else {
    next();
  }
});

UserSchema.methods.comparePassword = async function (password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    return false;
  }
};

UserSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      role: this.role,
    },
    constants.JWT_SECRET,
    {
      expiresIn: '1h',
    }
  );
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
