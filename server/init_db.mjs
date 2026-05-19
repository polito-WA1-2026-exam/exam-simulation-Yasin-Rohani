import sqlite3 from 'sqlite3';
import crypto from 'crypto';

const db = new sqlite3.Database('studyplan.sqlite');

function createUser(email, name, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { email, name, hash, salt };
}

const users = [
  createUser('john@polito.it', 'John Doe', 'password'),
  createUser('mary@polito.it', 'Mary Jane', 'password'),
  createUser('alex@polito.it', 'Alex Smith', 'password'),
  createUser('emma@polito.it', 'Emma Brown', 'password'),
  createUser('luca@polito.it', 'Luca Rossi', 'password')
];

db.serialize(() => {
  db.run('DROP TABLE IF EXISTS study_plan_courses');
  db.run('DROP TABLE IF EXISTS study_plans');
  db.run('DROP TABLE IF EXISTS incompatibilities');
  db.run('DROP TABLE IF EXISTS courses');
  db.run('DROP TABLE IF EXISTS users');

  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      hash TEXT NOT NULL,
      salt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE courses (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      credits INTEGER NOT NULL,
      max_students INTEGER,
      preparatory_code TEXT,
      FOREIGN KEY(preparatory_code) REFERENCES courses(code)
    )
  `);

  db.run(`
    CREATE TABLE incompatibilities (
      course_code TEXT NOT NULL,
      incompatible_code TEXT NOT NULL,
      PRIMARY KEY(course_code, incompatible_code),
      FOREIGN KEY(course_code) REFERENCES courses(code),
      FOREIGN KEY(incompatible_code) REFERENCES courses(code)
    )
  `);

  db.run(`
    CREATE TABLE study_plans (
      user_id INTEGER PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('full-time', 'part-time')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE study_plan_courses (
      user_id INTEGER NOT NULL,
      course_code TEXT NOT NULL,
      PRIMARY KEY(user_id, course_code),
      FOREIGN KEY(user_id) REFERENCES study_plans(user_id),
      FOREIGN KEY(course_code) REFERENCES courses(code)
    )
  `);

  const insertUser = db.prepare(`
    INSERT INTO users(email, name, hash, salt)
    VALUES (?, ?, ?, ?)
  `);

  for (const u of users) {
    insertUser.run(u.email, u.name, u.hash, u.salt);
  }

  insertUser.finalize();

  const insertCourse = db.prepare(`
    INSERT INTO courses(code, name, credits, max_students, preparatory_code)
    VALUES (?, ?, ?, ?, ?)
  `);

  const courses = [
    ['02GOLOV', 'Architetture dei sistemi di elaborazione', 12, null, null],
    ['02LSEOV', 'Computer architectures', 12, null, null],
    ['01SQJOV', 'Data Science and Database Technology', 8, null, null],
    ['01SQMOV', 'Data Science e Tecnologie per le Basi di Dati', 8, null, null],
    ['01SQLOV', 'Database systems', 8, null, null],
    ['01OTWOV', 'Computer network technologies and services', 6, 3, null],
    ['02KPNOV', 'Tecnologie e servizi di rete', 6, 3, null],
    ['01TYMOV', 'Information systems security services', 12, null, null],
    ['01UDUOV', 'Sicurezza dei sistemi informativi', 12, null, null],
    ['05BIDOV', 'Ingegneria del software', 6, null, '02GOLOV'],
    ['04GSPOV', 'Software engineering', 6, null, '02LSEOV'],
    ['01UDFOV', 'Applicazioni Web I', 6, null, null],
    ['01TXYOV', 'Web Applications I', 6, 3, null],
    ['01TXSOV', 'Web Applications II', 6, null, '01TXYOV'],
    ['02GRSOV', 'Programmazione di sistema', 6, null, null],
    ['01NYHOV', 'System and device programming', 6, 3, null],
    ['01SQOOV', 'Reti Locali e Data Center', 6, null, null],
    ['01TYDOV', 'Software networking', 7, null, null],
    ['03UEWOV', 'Challenge', 5, null, null],
    ['01URROV', 'Computational intelligence', 6, null, null],
    ['01OUZPD', 'Model based software design', 4, null, null],
    ['01URSPD', 'Internet Video Streaming', 6, 2, null]
  ];

  for (const c of courses) {
    insertCourse.run(...c);
  }

  insertCourse.finalize();

  const insertInc = db.prepare(`
    INSERT OR IGNORE INTO incompatibilities(course_code, incompatible_code)
    VALUES (?, ?)
  `);

  const incompatibilities = [
    ['02GOLOV', '02LSEOV'],
    ['02LSEOV', '02GOLOV'],

    ['01SQJOV', '01SQMOV'],
    ['01SQJOV', '01SQLOV'],
    ['01SQMOV', '01SQJOV'],
    ['01SQMOV', '01SQLOV'],
    ['01SQLOV', '01SQJOV'],
    ['01SQLOV', '01SQMOV'],

    ['01OTWOV', '02KPNOV'],
    ['02KPNOV', '01OTWOV'],

    ['01TYMOV', '01UDUOV'],
    ['01UDUOV', '01TYMOV'],

    ['05BIDOV', '04GSPOV'],
    ['04GSPOV', '05BIDOV'],

    ['01UDFOV', '01TXYOV'],
    ['01TXYOV', '01UDFOV'],

    ['02GRSOV', '01NYHOV'],
    ['01NYHOV', '02GRSOV']
  ];

  for (const i of incompatibilities) {
    insertInc.run(...i);
  }

  insertInc.finalize();

  db.run(`
    INSERT INTO study_plans(user_id, type)
    VALUES
    (1, 'full-time'),
    (2, 'part-time'),
    (3, 'full-time'),
    (4, 'part-time'),
    (5, 'part-time')
  `);

  db.run(`
    INSERT INTO study_plan_courses(user_id, course_code)
    VALUES
    -- user 1 full-time, 67 credits
    (1, '02LSEOV'),
    (1, '04GSPOV'),
    (1, '01TXYOV'),
    (1, '01TXSOV'),
    (1, '01URSPD'),
    (1, '01SQJOV'),
    (1, '01OTWOV'),
    (1, '01TYMOV'),
    (1, '03UEWOV'),

    -- user 2 part-time, 30 credits
    (2, '02GOLOV'),
    (2, '05BIDOV'),
    (2, '01URSPD'),
    (2, '01SQOOV'),

    -- user 3 full-time, 61 credits
    (3, '02LSEOV'),
    (3, '04GSPOV'),
    (3, '01TXYOV'),
    (3, '01TXSOV'),
    (3, '01SQLOV'),
    (3, '01NYHOV'),
    (3, '01TYDOV'),
    (3, '01URROV'),
    (3, '01OUZPD'),

    -- user 4 part-time, 25 credits
    (4, '01SQMOV'),
    (4, '02KPNOV'),
    (4, '01TYDOV'),
    (4, '01OUZPD'),

    -- user 5 part-time, 24 credits
    (5, '01TXYOV'),
    (5, '01TXSOV'),
    (5, '01NYHOV'),
    (5, '01SQOOV')
  `);

  console.log('Database initialized with full exam data.');
});

db.close();