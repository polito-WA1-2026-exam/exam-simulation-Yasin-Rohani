import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import session from 'express-session';
import passport from './passport.js';

const app = express();
const port = 3001;

app.use(express.json());

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const db = new sqlite3.Database('studyplan.sqlite', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
};

app.get('/api/courses', (req, res) => {
  const sql = `
    SELECT 
      c.code,
      c.name,
      c.credits,
      c.max_students AS maxStudents,
      c.preparatory_code AS preparatoryCode,
      COUNT(spc.user_id) AS enrolledStudents
    FROM courses c
    LEFT JOIN study_plan_courses spc ON c.code = spc.course_code
    GROUP BY c.code
    ORDER BY c.name ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/sessions', passport.authenticate('local'), (req, res) => {
  res.json(req.user);
});

app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated()) res.json(req.user);
  else res.status(401).json({ error: 'Not authenticated' });
});

app.delete('/api/sessions/current', (req, res) => {
  req.logout(() => res.end());
});

app.get('/api/studyplan', isLoggedIn, (req, res) => {
  const sqlPlan = `
    SELECT type
    FROM study_plans
    WHERE user_id = ?
  `;

  db.get(sqlPlan, [req.user.id], (err, plan) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!plan) return res.status(404).json({ error: 'Study plan not found' });

    const sqlCourses = `
      SELECT c.code, c.name, c.credits
      FROM study_plan_courses spc
      JOIN courses c ON spc.course_code = c.code
      WHERE spc.user_id = ?
      ORDER BY c.name ASC
    `;

    db.all(sqlCourses, [req.user.id], (err, courses) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      res.json({
        type: plan.type,
        courses
      });
    });
  });
});

app.post('/api/studyplan', isLoggedIn, (req, res) => {
  const { type } = req.body;

  if (type !== 'full-time' && type !== 'part-time') {
    return res.status(400).json({ error: 'Invalid study plan type' });
  }

  const sql = `
    INSERT INTO study_plans(user_id, type)
    VALUES (?, ?)
  `;

  db.run(sql, [req.user.id, type], function (err) {
    if (err) return res.status(409).json({ error: 'Study plan already exists' });

    res.status(201).json({
      userId: req.user.id,
      type,
      courses: []
    });
  });
});

app.delete('/api/studyplan', isLoggedIn, (req, res) => {
  db.run('DELETE FROM study_plan_courses WHERE user_id = ?', [req.user.id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    db.run('DELETE FROM study_plans WHERE user_id = ?', [req.user.id], function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Study plan not found' });

      res.status(204).end();
    });
  });
});

app.put('/api/studyplan', isLoggedIn, (req, res) => {
  const userId = req.user.id;
  const { courses } = req.body;

  if (!courses || !Array.isArray(courses)) {
    return res.status(400).json({ error: 'Courses array is required' });
  }

  const uniqueCourses = [...new Set(courses)];

  if (uniqueCourses.length !== courses.length) {
    return res.status(400).json({ error: 'Duplicate courses are not allowed' });
  }

  const sqlPlan = `
    SELECT type
    FROM study_plans
    WHERE user_id = ?
  `;

  db.get(sqlPlan, [userId], (err, plan) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!plan) return res.status(404).json({ error: 'Study plan not found' });

    if (courses.length === 0) {
      return res.status(400).json({ error: 'Study plan cannot be empty' });
    }

    const placeholders = courses.map(() => '?').join(',');

    const sqlCourses = `
      SELECT code, credits
      FROM courses
      WHERE code IN (${placeholders})
    `;

    db.all(sqlCourses, courses, (err, selectedCourses) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      if (selectedCourses.length !== courses.length) {
        return res.status(400).json({ error: 'One or more courses do not exist' });
      }

      const totalCredits = selectedCourses.reduce((sum, course) => sum + course.credits, 0);

      if (plan.type === 'full-time' && (totalCredits < 60 || totalCredits > 80)) {
        return res.status(400).json({
          error: 'Full-time must be between 60 and 80 credits'
        });
      }

      if (plan.type === 'part-time' && (totalCredits < 20 || totalCredits > 40)) {
        return res.status(400).json({
          error: 'Part-time must be between 20 and 40 credits'
        });
      }

      db.run('DELETE FROM study_plan_courses WHERE user_id = ?', [userId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const stmt = db.prepare(`
          INSERT INTO study_plan_courses(user_id, course_code)
          VALUES (?, ?)
        `);

        for (const courseCode of courses) {
          stmt.run(userId, courseCode);
        }

        stmt.finalize((err) => {
          if (err) return res.status(500).json({ error: 'Database error' });

          res.status(200).json({
            message: 'Study plan updated',
            totalCredits
          });
        });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});