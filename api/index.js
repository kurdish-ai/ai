const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 1. Explicitly allow your GitHub Pages origin
const corsOptions = {
    origin: 'https://kurdish-ai.github.io',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// 2. Handle the Preflight (OPTIONS) request BEFORE any routes
app.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://kurdish-ai.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

app.post('/api/chat', async (req, res) => {
    try {
        const model = "gemini-3-flash-preview"; 
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await axios.post(url, req.body);
        res.json(response.data);
    } catch (error) {
        console.error("API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to connect to AI" });
    }
});

module.exports = app;
