import express from 'express';
import pool from '../../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET;

(async()=>{
    try{
    await pool.execute(`
         CREATE TABLE IF NOT EXISTS users(
             id INT AUTO_INCREMENT PRIMARY KEY,
             name VARCHAR(255) NOT NULL,
             email VARCHAR(255) NOT NULL UNIQUE,
             password VARCHAR(255) NOT NULL
         )`);
         console.log("Users table initialized");
    }catch(err){
        console.error("Error initializing user routes:", err);
    }
})();
//registration route
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password) VALUES(?, ?, ?)',
      [name, email, hashed]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: result.insertId,
        name,
        email
      }
    });
  } catch (err) {
    console.error("Registration Error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: err.message || "Registration failed" });
  }
});


//Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(400).send('Invalid email');

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send('Invalid password');

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

//  Protected Route (decode token)
router.get('/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send('No token provided');

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    // decoded has id, email, name
    res.json(decoded);
  } catch (err) {
    res.status(401).send('Invalid token');
  }
});


export default router;