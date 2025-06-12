// server/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';

dotenv.config(); // Load environment variables from .env file

import { connectDB } from './src/config/MongoDB.js'; // Function to connect to MongoDB
import { connectRedis } from './src/config/Redis.js'; // Function to connect to Redis

// Import routes
const app = express();
app.use(express.json());
import wordleRoutes from './src/routes/WordleRoutes.js';
// const gameRoutes = require('./src/routes/gameRoutes');
// const authRoutes = require('./src/routes/authRoutes'); // Future: for login/signup

const PORT = process.env.PORT || 5000;

// Connect to databases
connectDB();


connectRedis();
console.log("DOne");
// Middleware
app.use(cors()); 
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.use('/api/words', wordleRoutes);

// TODO: Store games and access via gameRoutes and such
// app.use('/api/game', gameRoutes);
// app.use('/api/auth', authRoutes); // Future: for authentication

// TODO: DO I need this? 
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
    });
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});