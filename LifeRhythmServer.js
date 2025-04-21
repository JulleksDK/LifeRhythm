// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database forbindelse pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'liferhythm_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// JWT hemmelighed
const JWT_SECRET = process.env.JWT_SECRET || 'liferhythm-secure-secret-key';

// Middlware til at verificere JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Adgang nægtet' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token er ugyldig' });
    req.user = user;
    next();
  });
};

// Bruger-registrering
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Validering
    if (!email || !password) {
      return res.status(400).json({ error: 'Email og adgangskode er påkrævet' });
    }
    
    // Tjek om brugeren allerede eksisterer
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email er allerede i brug' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Gem bruger i database
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName]
    );
    
    // Opret brugerindstillinger
    await pool.execute(
      'INSERT INTO user_preferences (user_id) VALUES (?)',
      [result.insertId]
    );
    
    res.status(201).json({ 
      message: 'Bruger oprettet succesfuldt',
      userId: result.insertId 
    });
  } catch (error) {
    console.error('Fejl ved registrering:', error);
    res.status(500).json({ error: 'Der opstod en fejl ved registrering' });
  }
});

// Bruger-login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validering
    if (!email || !password) {
      return res.status(400).json({ error: 'Email og adgangskode er påkrævet' });
    }
    
    // Find bruger
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Ugyldig email eller adgangskode' });
    }
    
    const user = users[0];
    
    // Sammenlign password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ugyldig email eller adgangskode' });
    }
    
    // Opdater sidste login
    await pool.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
      [user.user_id]
    );
    
    // Generer JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      message: 'Login succesfuldt',
      token,
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Fejl ved login:', error);
    res.status(500).json({ error: 'Der opstod en fejl ved login' });
  }
});

// Hent brugeroplysninger
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT user_id, email, first_name, last_name, created_at FROM users WHERE user_id = ?',
      [req.user.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Bruger ikke fundet' });
    }
    
    const user = users[0];
    
    // Hent brugerindstillinger
    const [preferences] = await pool.execute(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      [user.user_id]
    );
    
    res.json({
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at
      },
      preferences: preferences[0] || {}
    });
  } catch (error) {
    console.error('Fejl ved hentning af brugerdata:', error);
    res.status(500).json({ error: 'Der opstod en fejl ved hentning af brugerdata' });
  }
});

// Hent aktivitetstyper
app.get('/api/activity-types', authenticateToken, async (req, res) => {
  try {
    const [activityTypes] = await pool.execute('SELECT * FROM activity_types');
    res.json(activityTypes);
  } catch (error) {
    console.error('Fejl ved hentning af aktivitetstyper:', error);
    res.status(500).json({ error: 'Der opstod en fejl ved hentning af aktivitetstyper' });
  }
});

// Opret en ugeplan
app.post('/api/schedules', authenticateToken, async (req, res) => {
  try {
    const { weekNumber, year } = req.body;
    const userId = req.user.userId;
    
    // Valider input
    if (!weekNumber || !year) {
      return res.status(400).json({ error: 'Ugenummer og år er påkrævet' });
    }
    
    // Tjek om ugeplanen allerede eksisterer
    const [existingSchedules] = await pool.execute(
      'SELECT * FROM weekly_schedules WHERE user_id = ? AND week_number = ? AND year = ?',
      [userId, weekNumber, year]
    );
    
    if (existingSchedules.length > 0) {
      return res.status(409).json({ error: 'En ugeplan for denne uge eksisterer allerede' });
    }
    
    // Opret ugeplan
    const [result] = await pool.execute(
      'INSERT INTO weekly_schedules (user_id, week_number, year) VALUES (?, ?, ?)',
      [userId, weekNumber, year]
    );
    
    res.status(201).json({
      message: 'Ugeplan oprettet succesfuldt',
      scheduleId: result.insertId,
      weekNumber,
      year
    });
  } catch (error) {
    console.error('Fejl ved oprettelse af ugeplan:', error);
    res.status(500).json({ error: 'Der opstod en fejl ved oprettelse af ugeplanen' });
  }
});

// Tilføj aktivitet til ugeplan
app.post('/api/activities', authenticateToken, async (req, res) => {
  try {
    const { scheduleId, activityTypeId, title, description, dayOfWeek, startTime, endTime, priority } = req.body;
    
    // Validering
    if (!scheduleId || !activityTypeId || !title || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ error: 'Manglende påkrævede felter' });
    }
    
    // Tjek om ugeplanen tilhører brugeren
    const [schedules] = await pool.execute(
      'SELECT * FROM weekly_schedules WHERE schedule_id = ? AND user_id = ?',
      [scheduleId, req.user.userId]
    );
    
    if (schedules.length === 0) {
      return res.status(403).json({ error: 'Du har ikke adgang til denne ugeplan' });
    }
    
    // Tilføj aktivitet
    const [result] = await pool.execute(
      `INSERT INTO schedule_activities 
       (schedule_id, activity_type_id, title, description, day_of_week, start_time, end_time, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [scheduleId, activityTypeId, title, description, dayOfWeek, startTime, endTime, priority || 3]
    );
    
    res.status(201).json({
      message: 'Aktivitet tilføjet succesfuldt',
      activityId: result.insertId
    });
  } catch (error) {
    console.error('Fejl ved tilføjelse af aktivitet:', error);
    res.status(500).json({ error: 'Der opstod en fejl ved tilføjelse af aktiviteten' });
  }
});

// Hent ugeplan
app.get('/api/schedules/:weekNumber/:year', authenticateToken, async (req, res) => {
  try {
    const { weekNumber, year } = req.params;
    const userId = req.user.userId;
    
    // Find ugeplanen
    const [schedules] = await pool.execute(
      'SELECT * FROM weekly_schedules WHERE user_id = ? AND week_number = ? AND year = ?',
      [userId, weekNumber, year]
    );
    
    if (schedules.length === 0) {
      return res.status(404).json({ error: 'Ugeplan ikke fundet' });
    }
    
    const schedule = schedules[0];
    
    // Hent aktiviteter for ugeplanen
    const [activities] = await pool.execute(
      `SELECT sa.*, at.name as activity_type_name, at.color, at.icon 
       FROM schedule_activities sa
       JOIN activity_types at ON sa.activity_type_id = at.activity_type_id
       WHERE sa.schedule_id = ?
       ORDER BY sa.day_of_week, sa.start_time`,
      [schedule.schedule_id]
    );
    
    res.json({
      schedule: {
        id: schedule.schedule_id,
        weekNumber: schedule.week_number,
        year: schedule.year,
        createdAt: schedule.created_at,
        lastModified: schedule.last_modified
      },
      activities
    });
  } catch (error) {
    console.error('Fejl ved hentning af ugeplan:', error);
    res.status(500).json({ error: 'Der opstod en fejl ved hentning af ugeplanen' });
  }
});

// Start serveren
app.listen(PORT, () => {
  console.log(`Server kører på port ${PORT}`);
});