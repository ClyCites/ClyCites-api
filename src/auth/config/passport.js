import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User from '../models/userModel.js';

export const configurePassport = () => {
  // JWT Strategy
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  }, async (payload, done) => {
    try {
      const user = await User.findById(payload.id);
      if (user && user.isActive && !user.isLocked) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  }));

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });

      if (user) {

        user.lastLogin = new Date();
        await user.save();
        return done(null, user);
      }

      user = await User.findOne({ email: profile.emails[0].value.toLowerCase() });

      if (user) {

        user.googleId = profile.id;
        user.isEmailVerified = true;
        user.lastLogin = new Date();
        await user.save();
        return done(null, user);
      }

      user = await User.create({
        googleId: profile.id,
        username: profile.emails[0].value.split('@')[0] + '_' + Date.now(),
        email: profile.emails[0].value.toLowerCase(),
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        profilePicture: profile.photos[0]?.value,
        isEmailVerified: true, // Google emails are pre-verified
        lastLogin: new Date()
      });

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
