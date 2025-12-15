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

        const requestBody = {
            message: document.getElementById('user-message').value,
            userData: {
                name: document.getElementById('name').value,
                kycDocuments: {
                    pan: document.getElementById('pan').value,
                    aadhaar: document.getElementById('aadhaar').value
                },
                cibilScore: parseInt(document.getElementById('cibil').value, 10),
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

        } catch (error) {
            console.error('API Error:', error);
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