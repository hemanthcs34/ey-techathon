require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { detectLoanIntent, presentAndNegotiateOffer } = require('./agents/masterAgent');
const { collectUserData } = require('./agents/dataAgent');
const { verifyKYC } = require('./agents/verificationAgent');
const { analyzeDocuments } = require('./agents/documentAnalysisAgent');
const { analyzeCredit } = require('./agents/creditAgent');
const { evaluateRiskAndPrice } = require('./agents/underwritingAgent');
const { executeApproval } = require('./agents/approvalAgent');
const { generateSanctionLetter } = require('./agents/documentAgent');
const { disburseFunds } = require('./agents/disbursementAgent');
const { getLedger } = require('./blockchain/ledger');
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

        // PHASE 3: Document Analysis (extract & verify PAN/Aadhaar + financial doc signals)
        const docAnalysis = await analyzeDocuments(sessionId, userData);
        cids.push({ step: 'documentAnalysis', cid: docAnalysis.cid });

        if (!docAnalysis.aadhaarVerified || !docAnalysis.panVerified) {
            return res.status(200).json({ status: 'rejected', reason: 'Document verification failed', cids });
        }

        // PHASE 3b: KYC & Identity Verification (accepts base64 or extracted text)
        const { kycStatus } = await verifyKYC(sessionId, userData.documents || {});
        if (kycStatus !== 'verified') {
            return res.status(200).json({ status: 'rejected', reason: 'KYC failed', cids });
        }

        // PHASE 4: Credit Score & Financial Risk Analysis
        // Attach document analysis to userData so credit agents can use extracted signals
        userData.docAnalysis = docAnalysis;
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
        const disbursementResult = await disburseFunds(sessionId, loanId, finalOffer);
        cids.push({ step: 'disbursement', cid: disbursementResult.disbursementCid });

        // PHASE 9: Log first (mock) EMI payment for monitoring startup
        const paymentResult = await logEmiPayment(loanId, { amount: 0, paymentDate: new Date().toISOString() });
        cids.push({ step: 'monitoring', cid: paymentResult.paymentCid });

        // Build dashboard info
        const paymentLedger = getLedger('payment_ledger');
        const paymentsForLoan = paymentLedger.filter(p => p.data.loanId === loanId).map(p => p.data);

        const schedule = disbursementResult.emiSchedule || [];
        const totalInstallments = schedule.length;
        const paidInstallments = paymentsForLoan.length;
        const remainingInstallments = Math.max(0, totalInstallments - paidInstallments);

        // Next installment is approx 30 days after last payment (or today if none)
        let lastPaymentDate = paymentsForLoan.length > 0 ? new Date(paymentsForLoan[paymentsForLoan.length - 1].paymentDate) : new Date();
        const nextInstallmentDate = new Date(lastPaymentDate.getTime() + 30*24*60*60*1000).toISOString();

        // Number of ongoing loans: count entries in loan_ledger
        const loanLedger = getLedger('loan_ledger');
        const ongoingLoans = loanLedger.length;

        res.status(200).json({
            status: 'approved',
            loanId,
            loanAmount: finalOffer.loanAmount,
            monthlyEmi: disbursementResult.monthlyEmi,
            remainingInstallments,
            nextInstallmentDate,
            ongoingLoans,
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
