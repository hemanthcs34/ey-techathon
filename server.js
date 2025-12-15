require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { detectLoanIntent, presentAndNegotiateOffer } = require('./agents/masterAgent');
const { collectUserData } = require('./agents/dataAgent');
const { verifyKYC } = require('./agents/verificationAgent');
const { analyzeCredit } = require('./agents/creditAgent');
const { evaluateRiskAndPrice } = require('./agents/underwritingAgent');
const { executeApproval } = require('./agents/approvalAgent');
const { generateSanctionLetter } = require('./agents/documentAgent');
const { disburseFunds } = require('./agents/disbursementAgent');
const { logEmiPayment } = require('./agents/monitoringAgent');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));
const port = process.env.PORT || 3001;

// The entire loan application flow
app.post('/loan', async (req, res) => {
    const cids = [];
    try {
        // PHASE 1: Customer Entry & Intent Detection
        const { message, userData } = req.body;
        const { intent, sessionId } = await detectLoanIntent(message);
        // CIDs from this phase are logged internally by the agent

        if (intent !== 'loanApplication') {
            return res.status(400).json({ status: 'rejected', reason: 'Invalid intent' });
        }

        // PHASE 2: Data Collection & Consent
        const { consentCid, interactionCid } = await collectUserData(sessionId, userData);
        cids.push({ step: 'consent', cid: consentCid }, { step: 'dataCollection', cid: interactionCid });

        // PHASE 3: KYC & Identity Verification
        const { kycStatus } = await verifyKYC(sessionId, userData.kycDocuments);
        if (kycStatus !== 'verified') {
            return res.status(200).json({ status: 'rejected', reason: 'KYC failed', cids });
        }

        // PHASE 4: Credit Score & Financial Risk Analysis
        const creditCheck = await analyzeCredit(sessionId, userData);
        cids.push({ step: 'creditAnalysis', cid: creditCheck.creditData.cid });
        if (!creditCheck.riskAcceptable) {
            return res.status(200).json({ status: 'rejected', reason: 'Credit risk not acceptable', cids });
        }
        
        // PHASE 4 (cont.): Underwriting
        const underwriting = await evaluateRiskAndPrice(sessionId, userData, creditCheck.creditData);
        cids.push({ step: 'underwriting', cid: underwriting.cid });
        if (!underwriting.eligibility) {
             return res.status(200).json({ status: 'rejected', reason: underwriting.reason, cids });
        }

        // PHASE 5: Loan Offer Generation & Negotiation
        const finalOffer = await presentAndNegotiateOffer(sessionId, underwriting.offer);
        // CIDs logged internally
        if(finalOffer.userResponse !== 'accepted'){
            return res.status(200).json({ status: 'rejected', reason: 'User rejected the offer', cids });
        }

        // PHASE 6: Loan Approval
        const approvalDetails = await executeApproval(sessionId, kycStatus, creditCheck, finalOffer);
        cids.push({ step: 'approval', cid: approvalDetails.approvalCid });
        if (approvalDetails.approvalStatus !== 'approved') {
            return res.status(200).json({ status: 'rejected', reason: approvalDetails.reason, cids });
        }

        // PHASE 7: Sanction Letter Generation
        const { loanId, sanctionCid } = await generateSanctionLetter(sessionId, approvalDetails, finalOffer);
        cids.push({ step: 'sanction', cid: sanctionCid });

        // PHASE 8: Disbursement
        const { disbursementCid } = await disburseFunds(sessionId, loanId, finalOffer);
        cids.push({ step: 'disbursement', cid: disbursementCid });

        // PHASE 9: Log first (mock) EMI payment for monitoring startup
        const { paymentCid } = await logEmiPayment(loanId, { amount: 0, paymentDate: new Date().toISOString() });
        cids.push({ step: 'monitoring', cid: paymentCid });

        res.status(200).json({
            status: 'approved',
            loanId,
            cids
        });

    } catch (error) {
        console.error("Loan processing failed:", error);
        res.status(500).json({ status: 'error', message: error.message, cids });
    }
});

// Endpoint for post-loan monitoring
app.post('/payment', async (req, res) => {
    try {
        const { loanId, paymentData } = req.body;
        const result = await logEmiPayment(loanId, paymentData);
        res.status(200).json(result);
    } catch (error) {
        console.error("Payment logging failed:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
