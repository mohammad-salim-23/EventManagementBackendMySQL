import express from 'express';
import pool from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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