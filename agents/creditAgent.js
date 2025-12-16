
const { appendToLedger } = require('../blockchain/ledger');
const policies = require('../rag/policies.json');
const { callGemini } = require('../utils/geminiClient');
const { uploadJsonToPinata } = require('../utils/pinataClient');
const { sha256 } = require('../utils/hash');
const { analyzeBankStatement } = require('./bankStatementAgent');

async function analyzeCredit(sessionId, userData) {
    const bankStatementAnalysis = await analyzeBankStatement(sessionId, userData);

    let riskDecision;
    if (bankStatementAnalysis.financialHealthScore >= 8) {
        riskDecision = 'low';
    } else if (bankStatementAnalysis.financialHealthScore >= 5) {
        riskDecision = 'medium';
    } else {
        riskDecision = 'high';
    }

    const creditData = {
        sessionId,
        bankStatementAnalysis,
        riskDecision,
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

