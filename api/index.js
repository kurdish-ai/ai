const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 1. Setup CORS with the '200 OK' fix for preflights
const corsOptions = {
    origin: 'https://kurdish-ai.github.io',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200 // CRITICAL: This fixes the "No HTTP ok status" error
};

app.use(cors(corsOptions));
app.use(express.json());

// 2. Explicitly handle the "OPTIONS" preflight request
app.options('*', cors(corsOptions));

app.post('/api/chat', async (req, res) => {
    try {
        const model = "gemini-3-flash-preview"; 
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Gemini 3 Flash supports "thinking_config" for better reasoning
        const payload = {
            contents: req.body.contents,
            thinking_config: {
                include_thoughts: true // Enables the new 2026 agentic reasoning
            }
        };

        const response = await axios.post(url, payload);
        res.json(response.data);
    } catch (error) {
        console.error("API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Server Error", details: error.message });
    }
});

// Export for Vercel
module.exports = app;
