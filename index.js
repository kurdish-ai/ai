require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.post('/api/chat', async (req, res) => {
    try {
        // Now using the valid Gemini 3 Flash Preview ID
        const model = "gemini-3-flash-preview"; 
        const apiKey = process.env.GEMINI_API_KEY;
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
            contents: req.body.contents,
            system_instruction: {
                parts: [{ 
                    text: "وەڵامەکانت زۆر کورت و پوخت بن. لە کۆتایی هەموو وەڵامێکدا ئەم رستەیە بنوسە: 'ئایا وەڵامێکی درێژترت دەوێت؟'" 
                }]
            }
        };

        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Gemini API Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: "API Error", 
            details: error.response ? error.response.data : error.message 
        });
    }
});

module.exports = app;