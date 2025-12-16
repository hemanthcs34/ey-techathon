const { getGenerativeAI } = require('../utils/geminiClient');
const { logInteraction } = require('../blockchain/ledger');

async function analyzeDocuments(sessionId, userData) {
    const model = getGenerativeAI();

    const prompt = `
        Analyze the provided documents for a loan application. The user has provided the following information:
        - Name: ${userData.name}
        - Monthly Income: ${userData.income}
        - Employment Type: ${userData.employmentType}
        - City: ${userData.city}
        - Loan Amount: ${userData.loanAmount}

        The documents are provided as base64 encoded strings. Decode them and perform the following analysis:
        1.  **Aadhaar Card:** Verify the name and address.
        2.  **PAN Card:** Verify the name and PAN number.
        3.  **Other Documents:** These could be bank statements, salary slips, or other financial documents. Analyze them to understand the user's financial stability.

        Return a JSON object with the following structure:
        {
            "aadhaarVerified": <boolean>,
            "panVerified": <boolean>,
            "financialStability": <"high" | "medium" | "low">
        }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = JSON.parse(response.text());

    const interactionData = {
        sessionId,
        agent: 'documentAnalysisAgent',
        prompt,
        response: analysis,
        timestamp: new Date().toISOString()
    };
    const cid = await logInteraction(interactionData);

    return { ...analysis, cid };
}

module.exports = { analyzeDocuments };
