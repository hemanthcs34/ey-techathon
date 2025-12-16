
const { appendToLedger } = require('../blockchain/ledger');
const { sha256 } = require('../utils/hash');
const { callGemini } = require('../utils/geminiClient');
const { uploadJsonToPinata } = require('../utils/pinataClient');

async function verifyKYC(sessionId, kycDocuments) {
    // Accept either plain text `pan`/`aadhaar` or base64 images `panCard`/`aadhaarCard`.
    const { pan, aadhaar, panCard, aadhaarCard } = kycDocuments || {};

    const usingImages = !!(panCard || aadhaarCard);

    let prompt;
    if (usingImages) {
        prompt = `You are given KYC images encoded as base64. Decode the images and extract the PAN number and Aadhaar number where possible. Then validate formats: PAN -> [A-Z]{5}[0-9]{4}[A-Z], Aadhaar -> 12 digits. Return a JSON object: { "kycStatus": "verified"|"rejected", "pan": "<extracted or empty>", "aadhaar": "<extracted or empty>", "reason": "explain" }.`;
    } else {
        prompt = `Please verify the following KYC documents. PAN: "${pan}", Aadhaar: "${aadhaar}". A valid PAN has the format [A-Z]{5}[0-9]{4}[A-Z]{1}. A valid Aadhaar has 12 digits. Respond with a JSON object containing a "kycStatus" key which can be "verified" or "rejected", and a "reason" key explaining why. If both are valid, the status is "verified".`;
    }

    const kycResultString = await callGemini(prompt);
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
        extracted: {
            pan: kycResult.pan || pan || null,
            aadhaar: kycResult.aadhaar || aadhaar || null
        },
        timestamp: new Date().toISOString()
    };

    const cid = await uploadJsonToPinata(verificationRecord);
    appendToLedger('identity_ledger', { ...verificationRecord, cid });

    return { kycStatus };
}

module.exports = { verifyKYC };
