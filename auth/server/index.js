// server.js

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const authController = require('./controllers/authController');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.post('/login', authController.login);
app.get('/logout', authController.logout);

// Example protected route
app.get('/dashboard', authController.isAuthenticated, (req, res) => {
  res.send('Welcome to the dashboard!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
