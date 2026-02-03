const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 1. CORS Configuration
const corsOptions = {
    origin: 'https://kurdish-ai.github.io',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// 2. FIXED: Named Wildcard for Express 5 (The fix for your PathError)
app.options('/*path', cors(corsOptions));

// 3. Chat Route
app.post('/api/chat', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "API Key missing in Vercel settings." });
        }

        const model = "gemini-3-flash-preview"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Forward the request to Google Gemini
        const response = await axios.post(url, req.body, {
            headers: { 'Content-Type': 'application/json' }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Gemini Error:", error.response?.data || error.message);
        res.status(500).json({ 
            error: "AI Connection Failed", 
            details: error.response?.data || error.message 
        });
    }
});

// 4. Test Route to check if server is alive
app.get('/api/test', (req, res) => {
    res.json({ status: "Server is running!", model: "Gemini 3 Flash" });
});

module.exports = app;
