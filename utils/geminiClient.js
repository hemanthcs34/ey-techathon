
const axios = require('axios');
require('dotenv').config();

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

async function callGemini(prompt) {
    if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not set in the environment variables.');
    }

    let retries = 5;
    let delay = 1000;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(geminiApiUrl, {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            });
            return response.data.candidates[0].content.parts[0].text;
        } catch (error) {
            if (error.response && error.response.status === 503 && i < retries - 1) {
                console.log(`Gemini API overloaded. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                console.error('Error calling Gemini API:', error.response ? error.response.data : error.message);
                throw new Error('Failed to call Gemini API.');
            }
        }
    }
}

module.exports = { callGemini };
