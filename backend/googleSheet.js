require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('./middleware/verifyToken');
// <-- 1. Import the Google Sheet helper
const { updateAttendanceInSheet } = require('./googleSheet.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT"]
    }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

io.on('connection', (socket) => {
    console.log('A user connected via WebSocket');
    socket.on('joinSession', (sessionId) => {
        socket.join(sessionId);
        console.log(`User joined session room: ${sessionId}`);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- TEACHER & ADMIN ROUTES ---
app.post('/api/teachers/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newTeacher = await pool.query(
            'INSERT INTO teachers (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );
        res.status(201).json(newTeacher.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.post('/api/teachers/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const teacher = await pool.query('SELECT * FROM teachers WHERE email = $1', [email]);
        if (teacher.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const validPassword = await bcrypt.compare(password, teacher.rows[0].password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign(
            { id: teacher.rows[0].id, name: teacher.rows[0].name },
            'your_jwt_secret_key',
            { expiresIn: '1h' }
        );
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.get('/api/students/unverified', verifyToken, async (req, res) => {
  try {
    const unverifiedStudents = await pool.query('SELECT id, name, roll FROM students WHERE is_verified = FALSE');
    res.json(unverifiedStudents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.put('/api/students/verify/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE students SET is_verified = TRUE WHERE id = $1', [id]);
    res.json({ message: 'Student verified successfully.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- STUDENT ROUTES ---
app.post('/api/students/register', async (req, res) => {
  const { name, roll, level, class_id, face_embedding, selfie_image } = req.body;
  if (!name || !roll || !level || !face_embedding || !selfie_image) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  try {
    const newStudent = await pool.query(
      'INSERT INTO students (name, roll, level, class_id, face_embedding, selfie_image, is_verified) VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING id, name',
      [name, roll, level, class_id, face_embedding, selfie_image]
    );
    res.status(201).json({ message: `Registration successful for ${newStudent.rows[0].name}. Please wait for teacher approval.` });
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') {
        return res.status(409).json({ message: 'A student with this roll number already exists.' });
    }
    res.status(500).send('Server Error');
  }
});

app.get('/api/students/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        const students = await pool.query(
            'SELECT id, name, roll FROM students WHERE class_id = $1 AND is_verified = TRUE',
            [classId]
        );
        res.json(students.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- SESSION AND ATTENDANCE ROUTES ---
app.post('/api/sessions/create', verifyToken, async (req, res) => {
  try {
    const teacherId = req.teacher.id;
    const { class_id } = req.body;
    const qrCodeToken = uuidv4();
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 2 * 60 * 1000);
    const newSession = await pool.query(
      'INSERT INTO sessions (teacher_id, class_id, qr_code_token, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING id AS "sessionId", qr_code_token',
      [teacherId, class_id || 'default_class', qrCodeToken, startTime, endTime]
    );
    res.json(newSession.rows[0]);
  } catch (err) {
    console.error("Error in /api/sessions/create:", err.message);
    res.status(500).send('Server Error');
  }
});

app.get('/api/session/:qrToken', async (req, res) => {
  try {
    const { qrToken } = req.params;
    const session = await pool.query(
      'SELECT id, class_id FROM sessions WHERE qr_code_token = $1 AND now() BETWEEN start_time AND end_time',
      [qrToken]
    );
    if (session.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found or has expired.' });
    }
    res.json(session.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.post('/api/attendance/mark', async (req, res) => {
  const { sessionId, studentId, liveFaceEmbedding } = req.body;
  try {
    const studentResult = await pool.query('SELECT name, roll, face_embedding FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
        return res.status(404).json({ message: 'Student not found.' });
    }
    const { name, roll, face_embedding: storedEmbedding } = studentResult.rows[0];

    let distance = 0;
    for (let i = 0; i < storedEmbedding.length; i++) {
        distance += Math.pow(storedEmbedding[i] - liveFaceEmbedding[i], 2);
    }
    distance = Math.sqrt(distance);

    if (distance > 0.6) {
        return res.status(401).json({ message: 'Face verification failed. Please try again.' });
    }
    
    await pool.query(
      'INSERT INTO attendance (student_id, session_id) VALUES ($1, $2)',
      [studentId, sessionId]
    );

    const newAttendance = { name, roll, verifiedAt: new Date() };
    io.to(sessionId.toString()).emit('newAttendance', newAttendance);
    
    // <-- 2. Call the function to update the sheet
    updateAttendanceInSheet(roll, name);
    
    res.status(200).json({ message: 'Attendance marked successfully!' });
  } catch (err) {
    if (err.code === '23505') {
        return res.status(409).json({ message: 'You have already marked your attendance for this session.' });
    }
    console.error("Error in /api/attendance/mark:", err.message);
    res.status(500).send('Server Error');
  }
});

// --- SERVER START ---
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});