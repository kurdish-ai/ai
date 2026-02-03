const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 1. Configure CORS to allow your GitHub Pages site
app.use(cors({
    origin: 'https://kurdish-ai.github.io', 
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// 2. Handle the "Preflight" request manually (Crucial for Vercel)
app.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'https://kurdish-ai.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;
