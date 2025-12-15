
const { appendToLedger } = require('../blockchain/ledger');
const policies = require('../rag/policies.json');
const { callGemini } = require('../utils/geminiClient');
const { uploadJsonToPinata } = require('../utils/pinataClient');
const { sha256 } = require('../utils/hash');

async function analyzeCredit(sessionId, userData) {
    const { cibilScore } = userData;

    if (typeof cibilScore !== 'number') {
        throw new Error("CIBIL score is required for credit analysis.");
    }

    const policy = policies.loanPolicies.find(p => cibilScore >= p.minCreditScore);

    const prompt = `Analyze the credit risk for a user with CIBIL score ${cibilScore}. The applicable policy is: ${JSON.stringify(policy)}. Based on this, is the risk 'low', 'medium', or 'high'? A score above 750 is low risk. If no policy is found, it is high risk. Respond with a JSON object with a "riskDecision" key. For example: {"riskDecision": "low"}`;

    const riskDecisionString = await callGemini(prompt);
    const { riskDecision } = JSON.parse(riskDecisionString);

    const creditData = {
        sessionId,
        cibilScore,
        riskDecision,
        policyId: policy ? policy.policyId : null
    };

    const cid = await uploadJsonToPinata(creditData);

    appendToLedger('credit_ledger', {
        agent: 'creditAgent',
        action: 'analyzeCredit',
        decisionHash: sha256(JSON.stringify(creditData)),
        cid,
        timestamp: new Date().toISOString()
    });

    return { 
        riskAcceptable: riskDecision !== 'high',
        creditData
    };
}

module.exports = { analyzeCredit };
