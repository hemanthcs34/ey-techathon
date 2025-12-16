
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
            const status = error.response ? error.response.status : undefined;

            if (status === 429 && i < retries - 1) {
                const message = error.response.data && error.response.data.error && error.response.data.error.message;
                const retryAfterHeader = error.response.headers && error.response.headers['retry-after'];
                const retryMatch = message ? message.match(/retry in\s+([0-9.]+)s/i) : null;
                const retrySeconds = retryAfterHeader ? Number(retryAfterHeader) : (retryMatch ? Number(retryMatch[1]) : null);
                const waitMs = retrySeconds && !Number.isNaN(retrySeconds) ? retrySeconds * 1000 : delay;

                console.log(`Gemini quota hit. Retrying in ${(waitMs / 1000).toFixed(1)}s...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                delay = Math.min(delay * 2, 16000);
                continue;
            }

            if (status === 503 && i < retries - 1) {
                console.log(`Gemini API overloaded. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, 16000); // Exponential backoff with cap
                continue;
            }

            console.error('Error calling Gemini API:', error.response ? error.response.data : error.message);
            const reason = status === 429 ? 'Quota exceeded; please retry later or reduce request rate.' : 'Failed to call Gemini API.';
            throw new Error(reason);
        }
    }
}

module.exports = { callGemini };
