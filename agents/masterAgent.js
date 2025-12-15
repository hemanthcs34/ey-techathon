
const { appendToLedger } = require('../blockchain/ledger');
const { sha256 } = require('../utils/hash');
const { callGemini } = require('../utils/geminiClient');
const { uploadJsonToPinata } = require('../utils/pinataClient');

async function detectLoanIntent(query) {
    const prompt = `Based on the user query, what is the intent? Query: "${query}". Respond with a single word from this list: "loanApplication", "loanStatus", "generalInquiry", "unknown".`;
    const intentResult = await callGemini(prompt);
    const intent = intentResult.replace(/[\r\n"]+/g, '');
    const sessionId = sha256(query + Date.now());

    const interaction = {
        agent: 'masterAgent',
        action: 'detectLoanIntent',
        sessionId,
        query,
        intent
    };

    const cid = await uploadJsonToPinata(interaction);
    appendToLedger('interaction_ledger', { ...interaction, cid });

    return { intent, sessionId };
}

async function presentAndNegotiateOffer(sessionId, offer) {
    const prompt = `A user is presented with a loan offer. The user can accept, reject, or negotiate. Here is the offer: ${JSON.stringify(offer)}. The user's policy is to accept if the interest rate is below 10%, otherwise they reject. What is the user's response? Respond with a JSON object that is the original offer object, plus a "userResponse" key ("accepted" or "rejected") and a "reason" key if rejected.`;
    const negotiationResult = await callGemini(prompt);
    const negotiatedOffer = JSON.parse(negotiationResult);

    const interaction = {
        agent: 'masterAgent',
        action: 'presentAndNegotiateOffer',
        sessionId,
        offer: negotiatedOffer
    };
    
    const cid = await uploadJsonToPinata(interaction);
    appendToLedger('interaction_ledger', { ...interaction, cid });

    if(negotiatedOffer.userResponse === 'accepted'){
        const offerForLedger = { sessionId, offer: negotiatedOffer, status: 'locked' };
        const offerCid = await uploadJsonToPinata(offerForLedger);
        appendToLedger('loan_offer_ledger', { ...offerForLedger, cid: offerCid });
    }
    return negotiatedOffer;
}

module.exports = { 
    detectLoanIntent,
    presentAndNegotiateOffer
};
