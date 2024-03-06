
const express = require('express');
const session = require('express-session');
const passport = require('passport');
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
const app = express();
dotenv.config();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.post('/login');
app.get('/logout');

// Example protected route
app.get('/',  (req, res) => {
  res.send('Welcome to the dashboard!');
});

// Start the server
const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    app.listen(PORT, () => console.log(`Server port: ${PORT}`));
  })
