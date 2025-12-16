document.addEventListener('DOMContentLoaded', () => {
    const loanForm = document.getElementById('loan-form');
    const statusDisplay = document.getElementById('status-display');
    const resultDisplay = document.querySelector('#loan-result pre code');
    const loader = document.getElementById('loader');
    const submitBtn = document.getElementById('apply-btn');
    const auditTrailSection = document.getElementById('audit-trail');
    const cidList = document.getElementById('cid-list');

    loanForm.addEventListener('submit', (event) => {
        event.preventDefault();
        handleLoanApplication();
    });

    function showLoading(isLoading) {
        if (isLoading) {
            loader.classList.remove('hidden');
            submitBtn.disabled = true;
            statusDisplay.innerHTML = '<p>Submitting... The agents are at work. This may take a moment.</p>';
            resultDisplay.textContent = '';
            auditTrailSection.classList.add('hidden');
            cidList.innerHTML = '';
        } else {
            loader.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    function displayAuditTrail(cids) {
        if (!cids || cids.length === 0) {
            auditTrailSection.classList.add('hidden');
            return;
        }

        cidList.innerHTML = ''; // Clear previous results
        
        cids.forEach(item => {
            if (!item.cid) return;

            const li = document.createElement('li');
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'cid-info';

            const phaseP = document.createElement('p');
            phaseP.className = 'cid-phase';
            phaseP.textContent = item.step || 'Unnamed Step';
            
            const link = document.createElement('a');
            link.className = 'cid-link';
            link.href = `https://gateway.pinata.cloud/ipfs/${item.cid}`;
            link.textContent = item.cid;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            infoDiv.appendChild(phaseP);
            infoDiv.appendChild(link);
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-cid-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(item.cid).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            });

            li.appendChild(infoDiv);
            li.appendChild(copyBtn);
            cidList.appendChild(li);
        });

        auditTrailSection.classList.remove('hidden');
    }

    async function handleLoanApplication() {
        showLoading(true);

        const aadhaarFile = document.getElementById('aadhaar-file').files[0];
        const panFile = document.getElementById('pan-file').files[0];
        const otherDocuments = document.getElementById('other-documents') ? document.getElementById('other-documents').files : [];
        const bankStatements = document.getElementById('bank-statements').files;
        const salarySlips = document.getElementById('salary-slips').files;
        const itrFiles = document.getElementById('itr-files').files;
        const bankProofFile = document.getElementById('bank-proof').files[0];
        const addressProofFile = document.getElementById('address-proof').files[0];
        const creditReportFile = document.getElementById('credit-report').files[0];

        let aadhaarCard = '';
        if (aadhaarFile) {
            aadhaarCard = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(aadhaarFile);
            });
        }

        let panCard = '';
        if (panFile) {
            panCard = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(panFile);
            });
        }

        // Helper to convert FileList to array of base64 strings
        async function filesToBase64Array(files) {
            if (!files || files.length === 0) return [];
            return Promise.all(Array.from(files).map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(file);
                });
            }));
        }

        const bankStatementStrings = await filesToBase64Array(bankStatements);
        const salarySlipStrings = await filesToBase64Array(salarySlips);
        const itrFileStrings = await filesToBase64Array(itrFiles);

        const singleFileToBase64 = (file) => {
            if (!file) return Promise.resolve('');
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
        };

        const bankProof = await singleFileToBase64(bankProofFile);
        const addressProof = await singleFileToBase64(addressProofFile);
        const creditReport = await singleFileToBase64(creditReportFile);

        const requestBody = {
            message: document.getElementById('user-message').value,
            userData: {
                name: document.getElementById('name').value,
                documents: {
                    aadhaarCard,
                    panCard,
                    bankStatements: bankStatementStrings,
                    salarySlips: salarySlipStrings,
                    itrFiles: itrFileStrings,
                    bankProof,
                    addressProof,
                    creditReport,
                    otherDocuments: otherDocuments && otherDocuments.length ? await filesToBase64Array(otherDocuments) : []
                },
                income: parseInt(document.getElementById('income').value, 10),
                employmentType: document.getElementById('employment-type').value,
                city: document.getElementById('city').value,
                loanAmount: parseInt(document.getElementById('loan-amount').value, 10),
                consent: {
                    kyc: true,
                    creditCheck: true
                }
            }
        };

        const apiUrl = '/loan';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const result = await response.json();

            displayAuditTrail(result.cids);

            if (!response.ok || result.status === 'error' || result.status === 'rejected') {
                throw result;
            }

            statusDisplay.innerHTML = `<p>Application processed! Status: <strong>${result.status.toUpperCase()}</strong></p>`;
            resultDisplay.textContent = JSON.stringify({
                status: result.status,
                loanId: result.loanId
            }, null, 2);

            // Save dashboard info and redirect to dashboard page
            const dashboardData = {
                loanId: result.loanId,
                loanAmount: result.loanAmount,
                monthlyEmi: result.monthlyEmi,
                remainingInstallments: result.remainingInstallments,
                nextInstallmentDate: result.nextInstallmentDate,
                ongoingLoans: result.ongoingLoans
            };
            localStorage.setItem('loanDashboard', JSON.stringify(dashboardData));
            // Give user a moment to read then redirect
            setTimeout(() => { window.location.href = '/dashboard.html'; }, 600);

        } catch (error) {
            console.error('API Error:', JSON.stringify(error, null, 2));
            const reason = error.reason || error.message || 'An unknown error occurred.';
            statusDisplay.innerHTML = `<p class="error"><strong>Application Failed</strong>: ${reason}</p>`;
            // Still display CIDs if the process failed midway but returned some
            displayAuditTrail(error.cids);
            resultDisplay.textContent = JSON.stringify(error, null, 2);
        } finally {
            showLoading(false);
        }
    }
});