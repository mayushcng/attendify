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
        // This line sends the 200 OK status and the token
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// ... (All other routes like /unverified, /verify, student register, session create, etc. go here) ...

// --- SERVER START ---
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});