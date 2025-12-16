document.addEventListener('DOMContentLoaded', () => {
    const data = JSON.parse(localStorage.getItem('loanDashboard') || '{}');

    document.getElementById('loan-id').textContent = data.loanId || 'N/A';
    document.getElementById('loan-amount').textContent = data.loanAmount ? `₹${data.loanAmount}` : 'N/A';
    document.getElementById('monthly-emi').textContent = data.monthlyEmi ? `₹${data.monthlyEmi}` : 'N/A';
    document.getElementById('remaining-installments').textContent = data.remainingInstallments != null ? data.remainingInstallments : 'N/A';
    document.getElementById('next-installment').textContent = data.nextInstallmentDate || 'N/A';
    document.getElementById('ongoing-loans').textContent = data.ongoingLoans != null ? data.ongoingLoans : 'N/A';

    document.getElementById('back-to-apply').addEventListener('click', () => {
        localStorage.removeItem('loanDashboard');
        window.location.href = '/';
    });
});