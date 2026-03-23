// Helper function to format dates in Cambodia timezone (ICT - UTC+7)
function formatCambodiaDateTime(date) {
  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Phnom_Penh'
  };
  return new Date(date).toLocaleString('en-US', options);
}

// View all invoices
const invoices = {
  // Initialize the page
  init() {
    this.loadInvoices();
  },

  // Load all invoices from server
  async loadInvoices() {
    const loadingContainer = document.getElementById('loadingContainer');
    const invoicesList = document.getElementById('invoicesList');
    const emptyMessage = document.getElementById('emptyMessage');

    loadingContainer.style.display = 'block';
    invoicesList.innerHTML = '';
    emptyMessage.style.display = 'none';

    try {
      const response = await fetch('/api/invoices');
      const result = await response.json();

      loadingContainer.style.display = 'none';

      if (result.success && result.count > 0) {
        // Display invoices
        result.data.forEach(invoice => {
          const listItem = document.createElement('li');
          listItem.className = 'invoice-item';

          const date = new Date(invoice.created_at);
          const dateTimeStr = formatCambodiaDateTime(date);

          listItem.innerHTML = `
            <div class="invoice-info">
              <h3>${invoice.invoice_number}</h3>
              <p><strong>Customer:</strong> ${invoice.customer_name}</p>
              <p><strong>Amount:</strong> $${parseFloat(invoice.total_amount).toFixed(2)}</p>
              <p><strong>Date:</strong> ${dateTimeStr}</p>
            </div>
            <div class="invoice-actions">
              <a href="/invoice/${invoice.id}" class="btn-view">View Details</a>
              <button class="btn btn-danger" onclick="invoices.deleteInvoice(${invoice.id})">
                Delete
              </button>
            </div>
          `;

          invoicesList.appendChild(listItem);
        });
      } else {
        // Show empty message
        emptyMessage.style.display = 'block';
      }
    } catch (error) {
      console.error('Error:', error);
      loadingContainer.style.display = 'none';
      this.showMessage('Error loading invoices', 'error');
    }
  },

  // Delete invoice
  async deleteInvoice(id) {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        this.showMessage('✓ Invoice deleted successfully', 'success');
        setTimeout(() => {
          this.loadInvoices();
        }, 1500);
      } else {
        this.showMessage('Error: ' + result.message, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      this.showMessage('Error deleting invoice', 'error');
    }
  },

  // Show message
  showMessage(message, type) {
    const container = document.getElementById('messageContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    container.innerHTML = '';
    container.appendChild(messageDiv);

    if (type === 'success') {
      setTimeout(() => messageDiv.remove(), 5000);
    }
  }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => invoices.init());
