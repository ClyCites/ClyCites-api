const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(require('express-session')({ secret: 'secret', resave: false, saveUninitialized: false }));

// Mock user database (replace with actual database integration)
const users = [
  { id: 1, username: 'user1', password: '$2a$10$97cMn8i/4JDSgh1/S9Zs4.GFf1OeqB6F0Dh7u5lJv8q6oUygl6mEu' } // Password: password1
];

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport local strategy configuration
passport.use(new LocalStrategy((username, password, done) => {
  const user = users.find(u => u.username === username);
  if (!user) {
    return done(null, false, { message: 'Incorrect username.' });
  }
  bcrypt.compare(password, user.password, (err, res) => {
    if (res) {
      return done(null, user);
    } else {
      return done(null, false, { message: 'Incorrect password.' });
    }
  });
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Login route
app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login',
  failureFlash: true
}));

// Logout route
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

// Middleware to ensure authenticated users access certain routes
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Example protected route
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.send('Welcome to the dashboard!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
