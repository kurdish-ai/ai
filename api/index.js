const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 1. Allow GitHub Pages to talk to this server
const corsOptions = {
    origin: 'https://kurdish-ai.github.io', // Your Frontend
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200 // Fixes the "Not HTTP ok status" error
};

// Apply CORS to everything
app.use(cors(corsOptions));
app.use(express.json());

// 2. Explicitly handle the Preflight (OPTIONS) request
// (In Express 4, '*' works perfectly fine)
app.options('*', cors(corsOptions));

// 3. The Chat Route
app.post('/api/chat', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "API Key is missing in Vercel settings" });
        }

        const model = "gemini-3-flash-preview";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await axios.post(url, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Gemini Error:", error.response?.data || error.message);
        res.status(500).json({ 
            error: "Failed to fetch from AI", 
            details: error.response?.data || error.message 
        });
    }
});

// Test route to verify server is running
app.get('/', (req, res) => res.send("Server is Running!"));

module.exports = app;
