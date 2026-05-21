import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import sqlite3 from 'sqlite3';
import crypto from 'crypto';

const db = new sqlite3.Database('studyplan.sqlite');

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    (email, password, done) => {
      const sql = `
        SELECT *
        FROM users
        WHERE email = ?
      `;

      db.get(sql, [email], (err, user) => {
        if (err) {
          return done(err);
        }

        if (!user) {
          return done(null, false, {
            message: 'Incorrect email'
          });
        }

        const hashedPassword = crypto
          .scryptSync(password, user.salt, 64)
          .toString('hex');

        if (hashedPassword !== user.hash) {
          return done(null, false, {
            message: 'Incorrect password'
          });
        }

        return done(null, {
          id: user.id,
          email: user.email,
          name: user.name
        });
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const sql = `
    SELECT id, email, name
    FROM users
    WHERE id = ?
  `;

  db.get(sql, [id], (err, user) => {
    if (err) {
      done(err, null);
    } else {
      done(null, user);
    }
  });
});

export default passport;
