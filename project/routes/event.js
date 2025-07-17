import express from 'express';
import pool from '../../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET;

// Initialize tables if not exist
(async () => {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                date DATE NOT NULL,
                time TIME NOT NULL,
                location VARCHAR(255),
                image_url VARCHAR(255),
                created_by INT NOT NULL,
                status ENUM('upcoming','completed','cancelled') DEFAULT 'upcoming'
            )
        `);
        console.log("Events table initialized with image_url");

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS event_participants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                user_id INT NOT NULL,
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('registered','cancelled','attended') DEFAULT 'registered'
            )
        `);
        console.log("Event participants table initialized");
    } catch (err) {
        console.error("Error initializing event tables:", err);
    }
})();

// Middleware for authentication
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send('No token provided');

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // { id, email, name }
        next();
    } catch (err) {
        res.status(401).send('Invalid token');
    }
};

// Get all events
router.get('/', async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM events');
    res.json(rows);
});

// Get events created by current user (for dashboard)
router.get('/my-events', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM events WHERE created_by = ?',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Get events the user has registered for (for dashboard)
router.get('/my-registrations', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT e.* FROM event_participants ep
             JOIN events e ON ep.event_id = e.id
             WHERE ep.user_id = ?`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Get single event by id
router.get('/:id', async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Event not found');
    res.json(rows[0]);
});

// Create event
router.post('/', authenticate, async (req, res) => {
    const { title, description, date, time, location, image_url } = req.body;

    try {
        // 1.insert statement
        const [result] = await pool.execute(
            'INSERT INTO events (title, description, date, time, location, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, description, date, time, location, image_url, req.user.id]
        );

        // 2. catch id for new event
        const insertedId = result.insertId;

        // 3. Read the inserted data from the database
        const [rows] = await pool.execute('SELECT * FROM events WHERE id = ?', [insertedId]);

        // 4. Send the data back in the response
        res.status(201).json({
            message: 'Event created successfully with image',
            event: rows[0],
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Update event (only creator can update)
router.patch('/:id', authenticate, async (req, res) => {
    const { title, description, date, time, location, status, image_url } = req.body;
    const eventId = req.params.id;
    const userId = req.user.id;

    try {
        // Check if event exists and belongs to user
        const [eventRows] = await pool.execute('SELECT * FROM events WHERE id = ? AND created_by = ?', [eventId, userId]);
        if (eventRows.length === 0) {
            return res.status(403).send('You are not authorized to update this event');
        }

        await pool.execute(
            'UPDATE events SET title=?, description=?, date=?, time=?, location=?, status=?, image_url=? WHERE id=? AND created_by=?',
            [title, description, date, time, location, status, image_url, eventId, userId]
        );

        // Fetch updated event data
        const [updatedRows] = await pool.execute('SELECT * FROM events WHERE id = ?', [eventId]);

        res.json({
            message: 'Event updated successfully',
            event: updatedRows[0],
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Delete event (only creator can delete)
router.delete('/:id', authenticate, async (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;

    try {
        // Check if event exists and belongs to user
        const [eventRows] = await pool.execute('SELECT * FROM events WHERE id = ? AND created_by = ?', [eventId, userId]);
        if (eventRows.length === 0) {
            return res.status(403).send('You are not authorized to delete this event');
        }

        await pool.execute('DELETE FROM events WHERE id=? AND created_by=?', [eventId, userId]);
        res.json({ message: 'Event deleted successfully' });
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// Register for event
router.post('/:id/register', authenticate, async (req, res) => {
    const eventId = req.params.id;

    try {
        await pool.execute(
            'INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)',
            [eventId, req.user.id]
        );
        res.send('Registered for event successfully');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Get participants with name and email for an event (only creator can view)
router.get('/:id/participants', authenticate, async (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;

    try {
        // Verify that the requesting user is the creator of the event
        const [eventRows] = await pool.execute('SELECT * FROM events WHERE id = ? AND created_by = ?', [eventId, userId]);
        if (eventRows.length === 0) {
            return res.status(403).send('You are not authorized to view participants of this event');
        }

        const [rows] = await pool.execute(
            `SELECT users.id, users.name, users.email 
             FROM event_participants 
             JOIN users ON event_participants.user_id = users.id 
             WHERE event_participants.event_id = ?`,
            [eventId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

export default router;
