const { getGenerativeAI } = require('../utils/geminiClient');
const { logInteraction } = require('../blockchain/ledger');

async function analyzeBankStatement(sessionId, userData) {
    const model = getGenerativeAI();

    const prompt = `
        Analyze the provided bank statement for a loan application. The user has provided the following information:
        - Name: ${userData.name}
        - Monthly Income: ${userData.income}
        - Employment Type: ${userData.employmentType}
        - City: ${userData.city}
        - Loan Amount: ${userData.loanAmount}

        The bank statement is provided as a base64 encoded string. Decode it and perform the following analysis:
        1.  **Average Balance:** Calculate the average monthly balance over the last 6 months.
        2.  **Income Verification:** Verify if the stated monthly income is consistent with the credits in the bank statement.
        3.  **Loan Repayment Capacity:** Assess the user's loan repayment capacity based on their income, expenses, and average balance.
        4.  **Financial Health Score:** Provide a financial health score from 1 to 10 (1 being poor, 10 being excellent).

        Return the analysis in a JSON object with the following structure:
        {
            "averageBalance": <number>,
            "incomeVerified": <boolean>,
            "repaymentCapacity": <"high" | "medium" | "low">,
            "financialHealthScore": <number>
        }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = JSON.parse(response.text());

    const interactionData = {
        sessionId,
        agent: 'bankStatementAgent',
        prompt,
        response: analysis,
        timestamp: new Date().toISOString()
    };
    const cid = await logInteraction(interactionData);

    return { ...analysis, cid };
}

module.exports = { analyzeBankStatement };
