require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

app.use(express.static('public'));

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI);

// Schéma utilisateur
const UserSchema = new mongoose.Schema({
  googleId: String,
  displayName: String,
  email: String,
  photo: String,
});
const User = mongoose.model('User', UserSchema);

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        photo: profile.photos[0].value,
      });
    }
    return done(null, user);
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// Route /me pour vérifier l'état de connexion
app.get('/me', (req, res) => {
  if (req.user) {
    res.json({ loggedIn: true, displayName: req.user.displayName, photo: req.user.photo });
  } else {
    res.json({ loggedIn: false });
  }
});

// Routes d'authentification
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/'); // Redirection vers la page d'accueil (index.html)
  }
);

// Route de profil
app.get('/profile', (req, res) => {
  if (!req.user) return res.redirect('/');
  res.send(`<h1>Profil</h1><p>Bienvenue ${req.user.displayName}</p><img src="${req.user.photo}" alt="Photo de profil"><br><a href="/">Accueil</a> | <a href="/logout">Déconnexion</a>`);
});

// Déconnexion
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.listen(3000, () => console.log('Serveur en cours sur http://localhost:3000'));