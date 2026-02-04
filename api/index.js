const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 1. Allow GitHub Pages to talk to this server
const corsOptions = {
    origin: 'https://kurdish-ai.github.io',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// 2. Handle the "Preflight" check
app.options('*', cors(corsOptions));

// 3. The Chat Route
app.post('/api/chat', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const model = "gemini-3-flash-preview";
        
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            req.body
        );

        res.json(response.data);
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = app;
