const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '1h', // default to 1 hour if JWT_EXPIRE is not set
    });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '7d', // Refresh token valid for 7 days
    });
};

// @desc Register new user
// @route POST /api/auth/register
const registerUser = async (req, res) => {
    const { fullName, email, password, role } = req.body; // Assuming role is included

    try {
        // Check if the user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user with the hashed password and role
        const user = new User({
            fullName,
            email,
            password: hashedPassword,
            role // Set the role based on request
        });
        await user.save();

        // Generate JWT and refresh token
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Store refresh token in an HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Secure in production
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        // Respond with the access token
        res.status(201).json({ token });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
};

// @desc Login user
// @route POST /api/auth/login
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT and refresh token
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Save refresh token to user
        user.refreshTokens.push({ token: refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        await user.save();

        // Respond with tokens
        res.status(200).json({ token, refreshToken });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc Get user profile
// @route GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Error fetching user data' });
    }
};

// @desc Get all users (Admin only)
// @route GET /api/auth/users
const getAllUsers = async (req, res) => {
    try {
        // Only allow admin users to access this route
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Fetch all users, excluding passwords
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

module.exports = { registerUser, loginUser, getMe, getAllUsers };
