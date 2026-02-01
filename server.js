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
        const model = "gemini-3-flash-preview"; 
        const apiKey = process.env.GEMINI_API_KEY;
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
            contents: req.body.contents,
            system_instruction: {
                parts: [{ 
                    text: "You are a helpful Kurdish AI assistant. Your answers must be very short, concise, and direct (max 2-3 sentences). At the very end of every response, on a new line, explicitly ask in Kurdish: 'ئایا وەڵامێکی درێژترت دەوێت؟' (Do you want a longer answer?). If the user says 'yes' or asks for more, provide a detailed explanation." 
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

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));