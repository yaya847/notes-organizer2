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

// Schéma pour stocker les notes/arborescence par utilisateur
const NoteSchema = new mongoose.Schema({
  userId: String, // googleId
  tree: mongoose.Schema.Types.Mixed // toute la structure des notes/dossiers
});
const Note = mongoose.model('Note', NoteSchema);

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
    // Utilise une URL ABSOLUE pour le callback, définie dans le .env
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
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

// --- NOUVEAUTÉ : API pour récupérer les notes de l'utilisateur connecté
app.get('/api/notes', async (req, res) => {
  if (!req.user) return res.json({ success: false, tree: null });
  const noteDoc = await Note.findOne({ userId: req.user.googleId });
  res.json({ success: true, tree: noteDoc ? noteDoc.tree : null });
});

// --- NOUVEAUTÉ : API pour sauvegarder les notes
app.post('/api/notes', express.json(), async (req, res) => {
  if (!req.user) return res.json({ success: false });
  await Note.findOneAndUpdate(
    { userId: req.user.googleId },
    { tree: req.body.tree },
    { upsert: true }
  );
  res.json({ success: true });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur en cours sur le port ${PORT}`));

/*
-----------------------------------------------
Instructions pour les variables d'environnement
-----------------------------------------------

Sur Render (DASHBOARD > Environment) :
- GOOGLE_CALLBACK_URL=https://notes-organizer2.onrender.com/auth/google/callback

En local (dans le fichier .env) :
- GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

Vérifie aussi que ta Google Cloud Console contient exactement :
- Origine JS autorisée : https://notes-organizer.netlify.app
- URI de redirection autorisée : https://notes-organizer2.onrender.com/auth/google/callback

-----------------------------------------------
*/