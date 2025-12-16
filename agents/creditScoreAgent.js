const { getGenerativeAI } = require('../utils/geminiClient');
const { logInteraction } = require('../blockchain/ledger');

async function calculateCreditScore(sessionId, documentAnalysis) {
    const model = getGenerativeAI();

    const prompt = `
        Based on the following document analysis, calculate a credit score between 300 and 850.

        - Aadhaar Verified: ${documentAnalysis.aadhaarVerified}
        - PAN Verified: ${documentAnalysis.panVerified}
        - Financial Stability: ${documentAnalysis.financialStability}

        A verified Aadhaar and PAN should contribute positively to the score. High financial stability should result in a higher score.

        Return a JSON object with the following structure:
        {
            "creditScore": <number>
        }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const score = JSON.parse(response.text());

    const interactionData = {
        sessionId,
        agent: 'creditScoreAgent',
        prompt,
        response: score,
        timestamp: new Date().toISOString()
    };
    const cid = await logInteraction(interactionData);

    return { ...score, cid };
}

module.exports = { calculateCreditScore };
