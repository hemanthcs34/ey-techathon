
const { appendToLedger } = require('../blockchain/ledger');
const { sha256 } = require('../utils/hash');
const { callGemini } = require('../utils/geminiClient');
const { uploadJsonToPinata } = require('../utils/pinataClient');

async function verifyKYC(sessionId, kycDocuments) {
    const { pan, aadhaar } = kycDocuments;

    if (!pan || !aadhaar) {
        throw new Error("PAN and Aadhaar documents are required for KYC.");
    }

    const prompt = `Please verify the following KYC documents. PAN: "${pan}", Aadhaar: "${aadhaar}". A valid PAN has the format [A-Z]{5}[0-9]{4}[A-Z]{1}. A valid Aadhaar has 12 digits. Respond with a JSON object containing a "kycStatus" key which can be "verified" or "rejected", and a "reason" key explaining why. If both are valid, the status is "verified".`;

    const kycResultString = await callGemini(prompt);

    // Clean the string to remove markdown formatting
    const cleanedKycResultString = kycResultString.replace(/```json/g, '').replace(/```/g, '');
    
    const kycResult = JSON.parse(cleanedKycResultString);
    const { kycStatus } = kycResult;

    const kycDocumentHash = sha256(JSON.stringify(kycDocuments));

    const verificationRecord = {
        agent: 'verificationAgent',
        action: 'verifyKYC',
        sessionId,
        kycDocumentHash,
        kycStatus,
        reason: kycResult.reason,
        timestamp: new Date().toISOString()
    };

    const cid = await uploadJsonToPinata(verificationRecord);

    appendToLedger('identity_ledger', { ...verificationRecord, cid });

    return { kycStatus };
}

module.exports = { verifyKYC };
