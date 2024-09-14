const express = require('express');
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const passport = require('passport');
const User = require('../models/userModel'); // Add this line to import the User model

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', protect, getMe);

// Admin-only route
router.get('/users', protect, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Now User is defined
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    const token = generateToken(req.user._id);
    res.status(200).json({ token });
});

router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        const newAccessToken = generateToken(user._id);
        res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});

module.exports = router;
